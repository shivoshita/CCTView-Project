"""
CCTView AI Service - FastAPI Application
Provides AI inference endpoints for vision, detection, embeddings, and depth analysis
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image
import io
import logging
import numpy as np

# Import model manager
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from models.model_manager import model_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="CCTView AI Service",
    version="1.0.0",
    description="AI inference service for surveillance video analysis"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class EmbeddingRequest(BaseModel):
    text: str


class BatchEmbeddingRequest(BaseModel):
    texts: List[str]
    batch_size: Optional[int] = 32


class CaptionResponse(BaseModel):
    success: bool
    caption: Optional[str] = None
    confidence: Optional[float] = None
    model: Optional[str] = None
    error: Optional[str] = None


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("=" * 60)
    logger.info("🚀 CCTView AI Service Starting...")
    logger.info("=" * 60)
    
    # Display device info
    device_info = model_manager.get_device_info()
    logger.info(f"🖥️  Device: {device_info['device']}")
    
    if device_info['cuda_available']:
        logger.info(f"✅ GPU: {device_info['gpu_name']}")
        logger.info(f"   VRAM: {device_info['memory_total_gb']:.2f} GB")
        logger.info(f"   CUDA: {device_info['cuda_version']}")
    else:
        logger.info("⚠️  Running on CPU (slower inference)")
    
    logger.info("\n📦 Models will load on first request to save memory")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("🛑 Shutting down CCTView AI Service...")
    model_manager.unload_models()


# Root endpoint
@app.get("/")
async def root():
    """Service information"""
    return {
        "service": "CCTView AI Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "gpu_info": "/gpu-info",
            "models_status": "/models/status",
            "caption_batch": "POST /caption/batch",
            "caption": "POST /caption",
            "detect": "POST /detect",
            "detect_yolo": "POST /detect/yolo",
            "depth": "POST /depth",
            "embed": "POST /embed",
            "batch_embed": "POST /embed/batch"
        }
    }

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint"""
    device_info = model_manager.get_device_info()
    models_status = model_manager.get_models_status()
    
    return {
        "status": "healthy",
        "device": device_info,
        "models_loaded": models_status
    }


@app.get("/gpu-info")
async def gpu_info():
    """Detailed GPU information"""
    return model_manager.get_device_info()


@app.get("/models/status")
async def models_status():
    """Get status of loaded models"""
    return {
        "status": model_manager.get_models_status(),
        "device": model_manager.device
    }


@app.post("/models/load/{model_type}")
async def load_model(model_type: str):
    """Manually load a specific model"""
    try:
        if model_type == "yolo":
            success = model_manager.load_yolo_model()
        elif model_type == "embedding":
            success = model_manager.load_embedding_model()
        elif model_type == "midas":
            success = model_manager.load_midas_model()
        elif model_type == "vision":
            return {"success": True, "message": "Vision model uses NVIDIA API (no local load required)"}
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model type: {model_type}. Use: yolo, embedding, midas, or vision"
            )

        return {
            "success": success,
            "message": f"{model_type} model {'loaded' if success else 'failed to load'} successfully"
        }

    except Exception as e:
        logger.error(f"Error loading model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/unload")
async def unload_models():
    """Unload all models to free GPU memory"""
    try:
        model_manager.unload_models()
        return {"success": True, "message": "All models unloaded successfully"}
    except Exception as e:
        logger.error(f"Error unloading models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/caption")
async def generate_caption(
    file: UploadFile = File(...),
    prompt: Optional[str] = "a surveillance camera view of"
):
    """
    Generate descriptive caption for uploaded image
    
    - **file**: Image file (JPEG, PNG)
    - **prompt**: Optional prompt to guide caption generation
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image (JPEG, PNG, etc.)"
            )
        
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        logger.info(f"📸 Processing image: {image.size}")
        
        # Generate caption
        result = model_manager.generate_caption(image, prompt)
        
        if result.get("success"):
            logger.info(f"✅ Caption: {result['caption']}")
            return JSONResponse({
                **result,
                "image_size": f"{image.width}x{image.height}"
            })
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Caption generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/caption/batch")
async def generate_batch_caption(
    files: List[UploadFile] = File(...),
    prompt: Optional[str] = None,
    frame_count: Optional[int] = None
):
    """
    Generate comprehensive caption for multiple frames (batch processing)
    
    - **files**: Multiple image files (accumulated frames)
    - **prompt**: Optional custom prompt (uses enhanced default if not provided)
    - **frame_count**: Number of frames (for validation)
    """
    try:
        # Validate files
        if not files:
            raise HTTPException(
                status_code=400,
                detail="At least one image file is required"
            )
        
        logger.info(f"🎬 Processing batch of {len(files)} frames for comprehensive caption")
        
        # Process all images
        images = []
        for i, file in enumerate(files):
            if not file.content_type.startswith("image/"):
                raise HTTPException(
                    status_code=400,
                    detail=f"File {i} must be an image"
                )
            
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            images.append(image)
            logger.debug(f"   Frame {i+1}: {image.size}")
        
        logger.info(f"📸 Loaded {len(images)} frames")
        
        # Strategy: Sample key frames if too many (reduce API calls)
        MAX_FRAMES = 8
        
        if len(images) > MAX_FRAMES:
            logger.info(f"⚡ Sampling {MAX_FRAMES} key frames from {len(images)} total")
            step = len(images) / MAX_FRAMES
            sampled_indices = [int(i * step) for i in range(MAX_FRAMES)]
            sampled_images = [images[i] for i in sampled_indices]
            logger.info(f"   Sampled indices: {sampled_indices}")
        else:
            sampled_images = images
        
        # Use enhanced prompt if not provided
        if prompt is None:
            prompt = f"""Analyze these {len(sampled_images)} surveillance frames captured sequentially over time.

Generate ONE comprehensive, detailed narrative description focusing on:

**CRITICAL: Avoid all repetition. If something stays constant (e.g., "person at desk"), mention it ONCE only.**

1. **Initial State**: Describe the starting scene - who is present, what they're doing, their positions
2. **Evolution & Changes**: Focus heavily on what CHANGES between frames:
   - Position changes (standing up, sitting down, moving closer/farther)
   - Activity transitions (from typing to looking at phone, from reading to writing)
   - Posture shifts (leaning forward, slouching, straightening up)
   - Attention changes (looking at screen → looking at person → looking away)
   - Object interactions (picking up items, putting down items, exchanging objects)
   - Facial expressions or gesture changes
3. **Interactions**: Any human-to-human interactions:
   - Conversations (starting, ongoing, ending)
   - Gestures or body language between people
   - Proximity changes (approaching, distancing)
   - Eye contact or attention direction
4. **Minute Details**: Capture subtle changes:
   - "shifts weight from left to right foot"
   - "glances briefly at phone"
   - "adjusts glasses"
   - "crosses/uncrosses arms"
   - "leans back in chair"
5. **Progression**: Use temporal flow words like "initially", "then", "subsequently", "after a moment", "gradually", "eventually"

**FORMAT**: Write as ONE flowing narrative paragraph, NOT as bullet points or frame-by-frame descriptions.

Now analyze the provided frames and generate the comprehensive narrative:"""
        
        logger.info(f"🤖 Generating comprehensive caption from {len(sampled_images)} frames using multi-image analysis")
        
        result = model_manager.generate_caption_from_multiple_frames(
            sampled_images, 
            prompt=prompt
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Failed to generate comprehensive caption")
            )
        
        comprehensive_caption = result["caption"]
        
        logger.info(f"✅ Comprehensive caption generated:")
        logger.info(f"   {comprehensive_caption[:200]}...")
        
        return JSONResponse({
            "success": True,
            "caption": comprehensive_caption,
            "confidence": result.get("confidence", 0.90),
            "model": "NVIDIA VILA (Multi-Frame Batch)",
            "frames_processed": len(images),
            "frames_analyzed": len(sampled_images)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Batch caption generation error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect")
async def detect_objects(
    file: UploadFile = File(...),
    confidence: Optional[float] = 0.5
):
    """
    Detect objects in uploaded image using YOLO
    
    - **file**: Image file (JPEG, PNG)
    - **confidence**: Confidence threshold (0.0 to 1.0)
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image"
            )
        
        # Validate confidence
        if not 0 <= confidence <= 1:
            raise HTTPException(
                status_code=400,
                detail="Confidence must be between 0 and 1"
            )
        
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        logger.info(f"🔍 Detecting objects in image: {image.size}")
        
        # Detect objects
        result = model_manager.detect_objects(image, confidence)
        
        if result.get("success"):
            logger.info(f"✅ Detected {result['count']} objects")
            return JSONResponse({
                **result,
                "image_size": f"{image.width}x{image.height}"
            })
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Object detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect/yolo")
async def detect_objects_yolo(
    image: UploadFile = File(...),
    confidence: Optional[float] = 0.5
):
    """
    YOLO object detection endpoint for real-time camera streams
    Optimized for fast inference on video frames
    
    - **image**: Image file (JPEG frame from camera)
    - **confidence**: Confidence threshold (default: 0.5)
    """
    try:
        # Validate file type
        if not image.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image"
            )
        
        # Read and process image
        contents = await image.read()
        image_pil = Image.open(io.BytesIO(contents))
        
        if image_pil.mode != 'RGB':
            image_pil = image_pil.convert('RGB')
        
        logger.debug(f"🔍 YOLO detection on frame: {image_pil.size}")
        
        # Detect objects using YOLO
        result = model_manager.detect_objects(image_pil, confidence)
        
        if result.get("success"):
            # Format response for frontend
            detections = []
            for det in result.get("detections", []):
                detections.append({
                    "bbox": det["bbox"],
                    "label": det["class"],
                    "confidence": det["confidence"]
                })
            
            return {
                "success": True,
                "detections": detections,
                "count": len(detections)
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail=result.get("error", "Detection failed")
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ YOLO detection error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/depth")
async def estimate_depth(
    file: UploadFile = File(...),
    colormap: str = Query(default="magma", description="Colormap: magma, inferno, plasma, viridis, turbo, jet, hot, cool"),
    return_image: bool = Query(default=True, description="Return depth image as PNG")
):
    """
    Estimate depth map from surveillance feed using MiDaS
    
    - **file**: Image file (JPEG, PNG)
    - **colormap**: Color scheme for depth visualization (magma=purple/yellow, inferno, plasma, viridis, turbo, jet, hot, cool)
    - **return_image**: If true, returns PNG image; if false, returns JSON with base64 encoded image
    
    The depth map shows distance from camera:
    - Purple/dark colors = objects NEAR camera (close)
    - Yellow/bright colors = objects FAR from camera (distant)
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail="File must be an image (JPEG, PNG, etc.)"
            )
        
        # Validate colormap
        valid_colormaps = ["magma", "inferno", "plasma", "viridis", "turbo", "jet", "hot", "cool"]
        if colormap.lower() not in valid_colormaps:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid colormap. Choose from: {', '.join(valid_colormaps)}"
            )
        
        # Read and process image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        logger.info(f"🎨 Estimating depth for image: {image.size} with colormap: {colormap}")
        
        # Estimate depth
        result = model_manager.estimate_depth(image, colormap)
        
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))
        
        logger.info(f"✅ Depth estimation complete")
        
        # Return as image stream (for direct display)
        if return_image:
            depth_colored = result["depth_colored"]
            depth_image = Image.fromarray(depth_colored)
            
            # Convert to PNG bytes
            img_byte_arr = io.BytesIO()
            depth_image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            return StreamingResponse(
                img_byte_arr,
                media_type="image/png",
                headers={
                    "X-Depth-Stats": str(result["depth_stats"]),
                    "X-Colormap": colormap,
                    "X-Model": "MiDaS"
                }
            )
        
        # Return as JSON with base64 encoded image
        else:
            import base64
            
            depth_colored = result["depth_colored"]
            depth_image = Image.fromarray(depth_colored)
            
            # Convert to base64
            img_byte_arr = io.BytesIO()
            depth_image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
            
            return JSONResponse({
                "success": True,
                "depth_image_base64": img_base64,
                "depth_stats": result["depth_stats"],
                "colormap": colormap,
                "model": "MiDaS",
                "image_size": f"{image.width}x{image.height}"
            })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Depth estimation error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed")
async def generate_embedding(request: EmbeddingRequest):
    """
    Generate embedding vector for text
    
    - **text**: Input text to embed
    """
    try:
        if not request.text:
            raise HTTPException(
                status_code=400,
                detail="Text cannot be empty"
            )
        
        logger.info(f"📝 Generating embedding for text: {request.text[:50]}...")
        
        # Generate embedding
        result = model_manager.generate_embedding(request.text)
        
        if result.get("success"):
            logger.info(f"✅ Generated {result['dimensions']}-dimensional embedding")
            return JSONResponse(result)
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Embedding generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch")
async def batch_generate_embeddings(request: BatchEmbeddingRequest):
    """
    Generate embeddings for multiple texts in batch
    
    - **texts**: List of texts to embed
    - **batch_size**: Batch processing size (default: 32)
    """
    try:
        if not request.texts:
            raise HTTPException(
                status_code=400,
                detail="Texts list cannot be empty"
            )
        
        logger.info(f"📝 Batch embedding {len(request.texts)} texts...")
        
        # Generate embeddings
        result = model_manager.batch_generate_embeddings(
            request.texts,
            request.batch_size
        )
        
        if result.get("success"):
            logger.info(f"✅ Generated {result['count']} embeddings")
            return JSONResponse(result)
        else:
            raise HTTPException(status_code=500, detail=result.get("error"))
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Batch embedding error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Endpoint not found", "path": str(request.url)}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting CCTView AI Service on port 8888...")
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8888,
        log_level="info",
        access_log=True
    )