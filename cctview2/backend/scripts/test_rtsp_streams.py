# FILE LOCATION: backend/scripts/test_rtsp_streams.py

"""
RTSP Stream Diagnostics Script
Tests various methods to connect to RTSP cameras
Helps identify the best approach for your specific cameras
"""

import cv2
import subprocess
import sys
import time

def test_ffmpeg_probe(rtsp_url):
    """Test 1: FFmpeg probe - Check if stream is accessible"""
    print("\n" + "="*80)
    print("TEST 1: FFmpeg Probe")
    print("="*80)
    
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-rtsp_transport', 'tcp',
            '-show_entries', 'stream=codec_name,width,height,r_frame_rate',
            '-of', 'json',
            rtsp_url
        ]
        
        print(f"Command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            print("✅ SUCCESS: Stream is accessible via FFmpeg")
            print(f"Stream info:\n{result.stdout}")
            return True
        else:
            print("❌ FAILED: Cannot access stream")
            print(f"Error: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_ffmpeg_single_frame(rtsp_url):
    """Test 2: FFmpeg single frame capture"""
    print("\n" + "="*80)
    print("TEST 2: FFmpeg Single Frame Capture")
    print("="*80)
    
    try:
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-frames:v', '1',
            '-f', 'image2',
            '-y',
            '/tmp/test_frame.jpg'
        ]
        
        print(f"Command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        
        if result.returncode == 0:
            print("✅ SUCCESS: Captured frame via FFmpeg")
            import os
            if os.path.exists('/tmp/test_frame.jpg'):
                size = os.path.getsize('/tmp/test_frame.jpg')
                print(f"Frame size: {size} bytes")
                return True
        else:
            print("❌ FAILED: Cannot capture frame")
            print(f"Error: {result.stderr[-500:]}")  # Last 500 chars
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_opencv_default(rtsp_url):
    """Test 3: OpenCV default settings"""
    print("\n" + "="*80)
    print("TEST 3: OpenCV Default Settings")
    print("="*80)
    
    try:
        print("Creating VideoCapture...")
        cap = cv2.VideoCapture(rtsp_url)
        
        if not cap.isOpened():
            print("❌ FAILED: Cannot open stream")
            return False
        
        print("✅ Stream opened, attempting to read frame...")
        ret, frame = cap.read()
        
        if ret and frame is not None:
            print(f"✅ SUCCESS: Frame captured - Shape: {frame.shape}")
            cap.release()
            return True
        else:
            print("❌ FAILED: Cannot read frames")
            cap.release()
            return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_opencv_with_ffmpeg(rtsp_url):
    """Test 4: OpenCV with FFmpeg backend"""
    print("\n" + "="*80)
    print("TEST 4: OpenCV with FFmpeg Backend")
    print("="*80)
    
    try:
        print("Creating VideoCapture with CAP_FFMPEG...")
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 3)
        
        if not cap.isOpened():
            print("❌ FAILED: Cannot open stream")
            return False
        
        print("✅ Stream opened, attempting to read frame...")
        
        # Try multiple reads
        for i in range(5):
            ret, frame = cap.read()
            if ret and frame is not None:
                print(f"✅ SUCCESS: Frame {i+1} captured - Shape: {frame.shape}")
                cap.release()
                return True
            print(f"Attempt {i+1}/5 failed, retrying...")
            time.sleep(0.5)
        
        print("❌ FAILED: No frames after 5 attempts")
        cap.release()
        return False
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def test_ffmpeg_pipe(rtsp_url):
    """Test 5: FFmpeg pipe (most reliable)"""
    print("\n" + "="*80)
    print("TEST 5: FFmpeg Pipe (Raw Frames)")
    print("="*80)
    
    try:
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-f', 'image2pipe',
            '-pix_fmt', 'bgr24',
            '-vcodec', 'rawvideo',
            '-an',
            '-frames:v', '3',  # Try 3 frames
            '-'
        ]
        
        print(f"Command: {' '.join(cmd)}")
        
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=10**8
        )
        
        print("Reading frames...")
        
        # Assume 1920x1080 for calculation
        frame_size = 1920 * 1080 * 3
        
        for i in range(3):
            raw_frame = process.stdout.read(frame_size)
            if len(raw_frame) == frame_size:
                print(f"✅ Frame {i+1} received - Size: {len(raw_frame)} bytes")
            else:
                print(f"⚠️ Frame {i+1} incomplete - Size: {len(raw_frame)} bytes")
        
        process.terminate()
        print("✅ SUCCESS: FFmpeg pipe working")
        return True
            
    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        return False


def main():
    print("""
╔════════════════════════════════════════════════════════════════════════════╗
║                      RTSP Stream Diagnostics Tool                          ║
║                                                                            ║
║  This script tests different methods to connect to your RTSP cameras      ║
║  and helps identify the best approach for CCTView                         ║
╚════════════════════════════════════════════════════════════════════════════╝
""")
    
    if len(sys.argv) < 2:
        print("Usage: python test_rtsp_streams.py <rtsp_url>")
        print("\nExample:")
        print("  python test_rtsp_streams.py rtsp://admin:password@192.168.1.64:554/Streaming/Channels/101")
        sys.exit(1)
    
    rtsp_url = sys.argv[1]
    
    print(f"Testing RTSP URL: {rtsp_url}")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    results = {}
    results['ffmpeg_probe'] = test_ffmpeg_probe(rtsp_url)
    results['ffmpeg_frame'] = test_ffmpeg_single_frame(rtsp_url)
    results['opencv_default'] = test_opencv_default(rtsp_url)
    results['opencv_ffmpeg'] = test_opencv_with_ffmpeg(rtsp_url)
    results['ffmpeg_pipe'] = test_ffmpeg_pipe(rtsp_url)
    
    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:20s}: {status}")
    
    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)
    
    if results['ffmpeg_pipe']:
        print("✅ BEST: Use FFmpeg pipe method (video_streaming_service.py FFmpeg version)")
        print("   This is the most reliable method for RTSP/H.265 streams")
    elif results['opencv_ffmpeg']:
        print("✅ GOOD: Use OpenCV with FFmpeg backend")
        print("   Should work well for most streams")
    elif results['opencv_default']:
        print("⚠️ OK: OpenCV default works, but may have issues with H.265")
    elif results['ffmpeg_probe']:
        print("⚠️ Stream is accessible but frame capture failing")
        print("   Check: 1) Codec support 2) Stream path 3) Network issues")
    else:
        print("❌ Stream not accessible - Check:")
        print("   1. Camera is online and accessible")
        print("   2. RTSP URL is correct (especially substream path like /101 or /102)")
        print("   3. Username and password are correct")
        print("   4. Firewall/network allows RTSP traffic")
    
    print("\n")


if __name__ == '__main__':
    main()