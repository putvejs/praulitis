"""
video_processor.py — Background HLS transcoding for uploaded videos.

After a video is saved to S3, call trigger() to spawn a daemon thread that:
  1. Downloads the video from S3
  2. Probes dimensions / duration with ffprobe
  3. Transcodes to 360p (and 720p if source is >= 720p) HLS segments
  4. Extracts a thumbnail frame at 2 s
  5. Uploads all HLS files + thumbnail to S3
  6. Updates the media row: hls_path, hls_status, duration_sec, thumbnail_filename
"""

import json
import logging
import os
import sqlite3
import subprocess
import tempfile
import threading
from pathlib import Path

log = logging.getLogger(__name__)


# ── DB helpers (direct sqlite3, no Flask context needed in thread) ──────────

def _db_update(db_path, media_id, **kwargs):
    conn = sqlite3.connect(db_path)
    sets = ", ".join(f"{k}=?" for k in kwargs)
    conn.execute(f"UPDATE media SET {sets} WHERE id=?", (*kwargs.values(), media_id))
    conn.commit()
    conn.close()


def _db_get(db_path, media_id, *cols):
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        f"SELECT {', '.join(cols)} FROM media WHERE id=?", (media_id,)
    ).fetchone()
    conn.close()
    return row


# ── ffprobe ─────────────────────────────────────────────────────────────────

def _probe(path):
    """Return (width, height, duration_sec) using ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_streams", "-show_format", path],
        capture_output=True, text=True, timeout=120,
    )
    data = json.loads(result.stdout or "{}")
    width = height = duration = 0
    for s in data.get("streams", []):
        if s.get("codec_type") == "video":
            width = int(s.get("width") or 0)
            height = int(s.get("height") or 0)
    try:
        duration = int(float(data.get("format", {}).get("duration") or 0))
    except (ValueError, TypeError):
        pass
    return width, height, duration


# ── ffmpeg helpers ───────────────────────────────────────────────────────────

def _encode_variant(input_path, out_dir, width, height, vbr_k, abr_k):
    """Encode one HLS variant. Returns True on success."""
    os.makedirs(out_dir, exist_ok=True)
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
               f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-maxrate", f"{vbr_k}k", "-bufsize", f"{vbr_k * 2}k",
        # Force keyframe every 6 s so segments are consistently short (no 14s surprises on mobile)
        "-force_key_frames", "expr:gte(t,n_forced*6)",
        "-c:a", "aac", "-b:a", f"{abr_k}k", "-ac", "2",
        "-f", "hls", "-hls_time", "6", "-hls_init_time", "6", "-hls_list_size", "0",
        "-hls_flags", "independent_segments",
        "-hls_segment_filename", os.path.join(out_dir, "seg%03d.ts"),
        os.path.join(out_dir, "playlist.m3u8"),
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=7200)
    if r.returncode != 0:
        log.error("ffmpeg failed: %s", r.stderr.decode()[-1000:])
        return False
    return True


def _extract_thumbnail(input_path, out_path, seek=2):
    subprocess.run(
        ["ffmpeg", "-y", "-ss", str(seek), "-i", input_path,
         "-frames:v", "1", "-q:v", "4", out_path],
        capture_output=True, timeout=60,
    )


# ── main task ────────────────────────────────────────────────────────────────

def _task(media_id, filename, db_path, bucket, region, cloudfront_url):
    import boto3

    log.info("[hls] Starting processing for media %d (%s)", media_id, filename)
    _db_update(db_path, media_id, hls_status="processing")

    try:
        s3 = boto3.client("s3", region_name=region)

        with tempfile.TemporaryDirectory() as tmp:
            inp = os.path.join(tmp, "input.mp4")
            hls_dir = os.path.join(tmp, "hls")
            thumb_path = os.path.join(tmp, "thumb.jpg")

            # 1. Download
            log.info("[hls] Downloading videos/%s from s3://%s", filename, bucket)
            s3.download_file(bucket, f"videos/{filename}", inp)

            # 2. Probe
            width, height, duration = _probe(inp)
            log.info("[hls] Probed: %dx%d, %ds", width, height, duration)

            # 3. Extract thumbnail
            _extract_thumbnail(inp, thumb_path)

            # 4. Choose quality variants
            variants = []  # (label, w, h, vbr_k, abr_k)
            if height >= 360:
                variants.append(("360p", 640, 360, 800, 96))
            if height >= 720:
                variants.append(("720p", 1280, 720, 2500, 128))
            if height > 720:
                variants.append(("1080p", 1920, 1080, 5000, 192))
            if not variants:
                # Very small source — single quality
                variants.append(("original", width or 640, height or 360, 800, 96))

            # 5. Encode each variant
            # H.264 High profile + AAC LC — universally supported on mobile
            CODECS = "avc1.640028,mp4a.40.2"
            master_lines = [
                "#EXTM3U",
                "#EXT-X-VERSION:3",
                "#EXT-X-INDEPENDENT-SEGMENTS",
                "",
            ]
            for label, w, h, vbr, abr in variants:
                log.info("[hls] Encoding %s (%dx%d @ %dk)…", label, w, h, vbr)
                var_dir = os.path.join(hls_dir, label)
                ok = _encode_variant(inp, var_dir, w, h, vbr, abr)
                if not ok:
                    raise RuntimeError(f"Encoding failed for {label}")
                bw = (vbr + abr) * 1000
                master_lines += [
                    f'#EXT-X-STREAM-INF:BANDWIDTH={bw},AVERAGE-BANDWIDTH={bw},RESOLUTION={w}x{h},CODECS="{CODECS}",NAME="{label}"',
                    f"{label}/playlist.m3u8",
                ]

            # 6. Write master playlist
            master_path = os.path.join(hls_dir, "master.m3u8")
            Path(master_path).write_text("\n".join(master_lines) + "\n")

            # 7. Upload HLS tree to S3
            hls_prefix = f"hls/{media_id}"
            for root, _, files in os.walk(hls_dir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    rel = os.path.relpath(fpath, hls_dir)
                    key = f"{hls_prefix}/{rel}"
                    ct = ("application/vnd.apple.mpegurl"
                          if fname.endswith(".m3u8") else "video/mp2t")
                    s3.upload_file(fpath, bucket, key, ExtraArgs={
                        "ContentType": ct,
                        "CacheControl": "max-age=31536000",
                    })

            # 8. Upload thumbnail (only if record has none yet)
            thumb_key = None
            existing = _db_get(db_path, media_id, "thumbnail_filename")
            if (not existing or not existing[0]) and os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 0:
                thumb_fn = f"hls_thumb_{media_id}.jpg"
                s3.upload_file(thumb_path, bucket, f"photos/{thumb_fn}", ExtraArgs={
                    "ContentType": "image/jpeg",
                    "CacheControl": "max-age=86400",
                })
                thumb_key = thumb_fn

            # 9. Update DB
            updates = {
                "hls_status": "done",
                "hls_path": f"{hls_prefix}/master.m3u8",
            }
            if duration:
                updates["duration_sec"] = duration
            if thumb_key:
                updates["thumbnail_filename"] = thumb_key
            _db_update(db_path, media_id, **updates)
            log.info("[hls] Done for media %d", media_id)

    except Exception:
        log.exception("[hls] Processing failed for media %d", media_id)
        _db_update(db_path, media_id, hls_status="error")


# ── public API ───────────────────────────────────────────────────────────────

def trigger(media_id, filename, db_path, bucket, region, cloudfront_url=""):
    """Spawn a background thread to transcode a video to HLS."""
    t = threading.Thread(
        target=_task,
        args=(media_id, filename, db_path, bucket, region, cloudfront_url),
        daemon=True,
        name=f"hls-{media_id}",
    )
    t.start()
    log.info("[hls] Queued processing for media %d in thread %s", media_id, t.name)
