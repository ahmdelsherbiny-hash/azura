import cv2
import numpy as np
import math
from PIL import Image

def create_hero_video(render_path, sketch_path, output_path, duration=10, fps=30):
    print("Loading source images...")
    # Target resolution
    width, height = 1920, 1080
    total_frames = duration * fps
    
    # Load with PIL for high quality resize
    img_render_pil = Image.open(render_path).convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
    img_sketch_pil = Image.open(sketch_path).convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
    
    # Convert to OpenCV BGR numpy arrays
    img_render = cv2.cvtColor(np.array(img_render_pil), cv2.COLOR_RGB2BGR)
    img_sketch = cv2.cvtColor(np.array(img_sketch_pil), cv2.COLOR_RGB2BGR)
    
    # Video Writer
    # Try mp4v or avc1 codec
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    print(f"Generating {total_frames} frames ({duration}s @ {fps}fps)...")
    
    for f in range(total_frames):
        # Progress
        if f % 60 == 0:
            print(f"Progress: {f}/{total_frames} frames ({f/total_frames*100:.1f}%)")
            
        t = f / total_frames # 0.0 to 1.0
        
        # Smooth sinusoidal back-and-forth oscillation: starts at left, goes to right, returns to left
        # sin(t * 2*pi - pi/2) goes from -1 to 1 to -1. Rescaled to 0.08 .. 0.92
        osc = (math.sin(t * 2 * math.pi - math.pi / 2) + 1.0) / 2.0
        sweep_x = int(0.06 * width + osc * (0.88 * width))
        
        # Slow cinematic subtle camera pan (Ken Burns drift: 1.0 to 1.04)
        zoom = 1.0 + 0.035 * math.sin(t * 2 * math.pi)
        pan_x = int(15 * math.sin(t * 2 * math.pi))
        pan_y = int(8 * math.cos(t * 2 * math.pi))
        
        # Apply crop zoom to both images identically
        zw = int(width / zoom)
        zh = int(height / zoom)
        x1 = max(0, min(width - zw, (width - zw)//2 + pan_x))
        y1 = max(0, min(height - zh, (height - zh)//2 + pan_y))
        
        curr_render = cv2.resize(img_render[y1:y1+zh, x1:x1+zw], (width, height), interpolation=cv2.INTER_LINEAR)
        curr_sketch = cv2.resize(img_sketch[y1:y1+zh, x1:x1+zw], (width, height), interpolation=cv2.INTER_LINEAR)
        
        # Composite frame: Left side = Render, Right side = Sketch (or vice versa depending on direction)
        # When moving right, render is revealed
        frame = np.empty_like(curr_render)
        frame[:, :sweep_x] = curr_render[:, :sweep_x]
        frame[:, sweep_x:] = curr_sketch[:, sweep_x:]
        
        # Draw Azura Blue Laser Beam with Glow
        # Laser beam parameters:
        beam_glow_radius = 24
        glow_x1 = max(0, sweep_x - beam_glow_radius)
        glow_x2 = min(width, sweep_x + beam_glow_radius)
        
        if glow_x2 > glow_x1:
            # Create glow overlay
            glow_strip = frame[:, glow_x1:glow_x2].astype(np.float32)
            
            # Distance from center of beam
            xs = np.arange(glow_x1, glow_x2) - sweep_x
            glow_profile = np.exp(-(xs**2) / (2 * (7.0**2))) # Gaussian
            
            # Azura blue laser color (BGR: [248, 189, 56] in RGB -> BGR: [248, 189, 56])
            laser_color_bgr = np.array([248, 189, 56], dtype=np.float32) # #38bdf8 in BGR
            gold_color_bgr = np.array([128, 168, 197], dtype=np.float32) # #c5a880 in BGR
            
            for i, x_offset in enumerate(xs):
                g = glow_profile[i]
                # Blend laser glow
                col = glow_x1 + i
                frame[:, col] = np.clip(
                    frame[:, col].astype(np.float32) * (1.0 - 0.45 * g) + 
                    (laser_color_bgr * 0.75 + gold_color_bgr * 0.25) * g * 1.6,
                    0, 255
                ).astype(np.uint8)
                
            # Sharp intense white-cyan core line (2-3px)
            core_x1 = max(0, sweep_x - 1)
            core_x2 = min(width, sweep_x + 2)
            frame[:, core_x1:core_x2] = np.clip(
                frame[:, core_x1:core_x2].astype(np.float32) * 0.2 + np.array([255, 245, 230], dtype=np.float32) * 0.9,
                0, 255
            ).astype(np.uint8)
            
        out.write(frame)
        
    out.release()
    print(f"Hero video successfully generated at: {output_path}")

if __name__ == '__main__':
    render = 'assets/images/hero_render.jpg'
    sketch = 'assets/images/hero_sketch.jpg'
    output = 'assets/images/hero_cinematic.mp4'
    create_hero_video(render, sketch, output, duration=10, fps=30)
