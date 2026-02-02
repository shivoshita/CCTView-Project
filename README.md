# 🎥 CCTView - AI-Powered Surveillance System

<div align="center">

![CCTView Banner](https://img.shields.io/badge/CCTView-AI%20Surveillance-blue?style=for-the-badge&logo=video&logoColor=white)

**Smart surveillance reimagined with cutting-edge AI**

[![Python](https://img.shields.io/badge/Python-3.9+-blue?style=flat-square&logo=python)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.0+-008CC1?style=flat-square&logo=neo4j)](https://neo4j.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[Features](#-features) • [Architecture](#-architecture) • [Installation](#-installation) • [Usage](#-usage) • [API Docs](#-api-documentation)

</div>

---

## 📖 Overview

CCTView is a next-generation surveillance system that leverages state-of-the-art AI models to provide intelligent video analysis, real-time person tracking, and automated anomaly detection across multiple camera feeds.

### 🎯 Key Highlights

- 🤖 **AI-Powered Vision**: NVIDIA VILA for scene understanding & YOLO for object detection
- 🪑 **Smart Chair Tracking**: Real-time occupancy detection with visual change analysis
- 👤 **Person Re-Identification**: Track individuals across multiple cameras
- 🎬 **Panoramic Views**: Automatic multi-camera stitching for wide-area monitoring
- 📊 **Graph Intelligence**: Neo4j-powered relationship mapping and event correlation
- ⚡ **Real-Time Processing**: WebSocket streams for instant alerts and captions

---

## 📖 Screenshots
<img width="1166" height="543" alt="image" src="https://github.com/user-attachments/assets/ce6d9311-c971-43d0-be18-46e01ed99e71" />
<img width="1168" height="597" alt="image" src="https://github.com/user-attachments/assets/bb938a24-046c-44df-97c8-034f6a0f35cd" />
<img width="1153" height="604" alt="image" src="https://github.com/user-attachments/assets/82a91714-612a-4a39-a09a-cd02041e6564" />
<img width="1167" height="552" alt="image" src="https://github.com/user-attachments/assets/2a755494-2cbf-437f-a6d5-85ed284b6bc9" />
<img width="1168" height="545" alt="image" src="https://github.com/user-attachments/assets/d2d6714a-133c-40d6-a6aa-bb16b60ca2cb" />
<img width="1163" height="542" alt="image" src="https://github.com/user-attachments/assets/deb8d07f-1807-41d0-a69a-d1bb58bdf82d" />
<img width="1169" height="554" alt="image" src="https://github.com/user-attachments/assets/73e37eca-1c8b-4698-a1f5-2ae763097560" />

---

## ✨ Features

### 🎥 Multi-Camera Management
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   RTSP/IP   │  │    HTTP     │  │   MJPEG     │
│   Cameras   │  │   Streams   │  │   Feeds     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                   [CCTView]
```

- **Universal Protocol Support**: RTSP, HTTP, MJPEG streams
- **HLS Transcoding**: Automatic conversion for web playback
- **Live Preview**: Real-time video streaming with overlays
- **Health Monitoring**: Automatic reconnection and status tracking

### 🧠 AI-Powered Analysis

#### 1. **Scene Understanding** (NVIDIA VILA)
```python
# Generates comprehensive captions from video frames
Input:  [Surveillance Frame]
Output: "A person sitting at desk typing on laptop 
         while another person walks past the door 
         carrying a briefcase..."
```

#### 2. **Object Detection** (YOLOv8)
- Real-time bounding boxes for people, chairs, vehicles, etc.
- Configurable confidence thresholds
- Multi-class detection with 80+ object categories

#### 3. **Chair Occupancy Tracking**
```
╔═══════════════════════════════════════════╗
║  🪑 Chair Tracking Algorithm              ║
╠═══════════════════════════════════════════╣
║                                           ║
║  METHOD 1: Visual Change Detection        ║
║  ├─ SSIM (Structural Similarity)          ║
║  ├─ Histogram Correlation                 ║
║  ├─ Edge Detection                        ║
║  └─ Mean Absolute Difference              ║
║                                           ║
║  METHOD 2: Person Detection Fallback      ║
║  └─ YOLO person + chair IoU > 0.12        ║
║                                           ║
║  HYBRID: Visual primary, Person backup    ║
║  SMOOTHING: 6-frame buffer (60% vote)     ║
╚═══════════════════════════════════════════╝
```

- **Hybrid Approach**: Combines visual analysis with person detection
- **Temporal Smoothing**: Reduces false positives with frame buffering
- **Duration Tracking**: Monitors how long chairs stay occupied/empty
- **Top-Down Optimized**: Works best with overhead camera angles

#### 4. **Person Re-Identification**
```
Camera 1              Camera 2              Camera 3
   │                     │                     │
   ├─[Person A]─────────┼─[Person A]──────────┤
   │                     │                     │
   └─[Person B]─────────┴─────────────[Person B]
   
   Similarity: 92%      Transition detected!
```

- **Cross-Camera Tracking**: Follow individuals across different views
- **Feature Embeddings**: Deep learning-based person signatures
- **Movement History**: Timeline of transitions between cameras

### 📊 Data Architecture

```
┌─────────────────────────────────────────────────┐
│              Frontend (React)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ Camera   │  │ Person   │  │ Anomaly  │      │
│  │ Grid     │  │ Re-ID    │  │ Alerts   │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼─────────────┼─────────────┘
        │             │             │
        │    WebSocket Connections  │
        │             │             │
┌───────┼─────────────┼─────────────┼─────────────┐
│       │    Backend (FastAPI)      │             │
│  ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐      │
│  │ Stream   │  │ Caption  │  │ Anomaly  │      │
│  │ Manager  │  │ Manager  │  │ Detector │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
└───────┼─────────────┼──────────────┼────────────┘
        │             │              │
┌───────▼─────────────▼──────────────▼────────────┐
│         AI Service (GPU Server)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ NVIDIA   │  │ YOLOv8   │  │ MiDaS    │      │
│  │ VILA     │  │ Detection│  │ Depth    │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
        │             │              │
┌───────▼─────────────▼──────────────▼────────────┐
│              Data Storage                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  Neo4j   │  │  Redis   │  │  Vector  │      │
│  │  Graph   │  │  Cache   │  │  Store   │      │
│  └──────────┘  └──────────┘  └──────────┘      │
└─────────────────────────────────────────────────┘
```

### 🔔 Anomaly Detection & Alerts

- **Rule-Based System**: Create custom detection rules
- **Severity Levels**: Critical, High, Medium, Low
- **Multi-Channel Alerts**: Email, SMS, WebSocket, Webhook
- **Smart Filtering**: Reduce false positives with confidence thresholds

---

## 🏗️ Architecture

### System Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React 18 + Vite | User interface & real-time dashboards |
| **Backend** | FastAPI + Python 3.9+ | API gateway & business logic |
| **AI Service** | PyTorch + CUDA 12.1 | GPU-accelerated inference |
| **Graph DB** | Neo4j 5.0+ | Event relationships & querying |
| **Cache** | Redis 7.0+ | Hot data & WebSocket state |
| **Video** | FFmpeg + HLS | Stream transcoding & delivery |

### AI Models

```
┌─────────────────────────────────────────────┐
│  Vision Language Model                      │
│  ├─ NVIDIA VILA (via API)                   │
│  ├─ Multi-frame temporal analysis           │
│  └─ Scene understanding & captioning        │
├─────────────────────────────────────────────┤
│  Object Detection                           │
│  ├─ YOLOv8n (nano - fast inference)         │
│  ├─ 80+ object classes                      │
│  └─ Real-time bounding boxes                │
├─────────────────────────────────────────────┤
│  Embeddings                                 │
│  ├─ Sentence-BERT (all-MiniLM-L6-v2)        │
│  ├─ 384-dimensional vectors                 │
│  └─ Semantic search & similarity            │
├─────────────────────────────────────────────┤
│  Depth Estimation                           │
│  ├─ MiDaS (DPT_Large)                       │
│  └─ Monocular depth maps                    │
└─────────────────────────────────────────────┘
```

---

## 🚀 Installation

### Prerequisites

- **Python**: 3.9 or higher
- **Node.js**: 18 or higher
- **CUDA**: 12.1+ (for GPU acceleration)
- **Neo4j**: 5.0+
- **Redis**: 7.0+
- **FFmpeg**: Latest stable

### Quick Start

#### 1. Clone Repository
```bash
git clone https://github.com/yourusername/cctview.git
cd cctview
```

#### 2. Backend Setup
```bash
cd cctview2/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Neo4j/Redis credentials

# Start backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 3. AI Service Setup
```bash
cd cctview-ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure NVIDIA API key
cp .env.example .env
# Add your NVIDIA_API_KEY

# Start AI service
uvicorn api.main:app --host 0.0.0.0 --port 8888
```

#### 4. Frontend Setup
```bash
cd cctview2/frontend
npm install

# Configure API endpoint
cp .env.example .env
# Set VITE_API_BASE_URL

# Start frontend
npm run dev
```

### 🐳 Docker Deployment (Recommended)

```bash
# Coming soon - Docker Compose configuration
docker-compose up -d
```

---

## 📱 Usage

### Adding a Camera

1. Navigate to **Cameras** page
2. Click **Add Camera**
3. Fill in details:
   ```json
   {
     "name": "Front Entrance",
     "location": "Building A, Floor 1",
     "stream_url": "rtsp://admin:pass@192.168.1.100:554/stream1",
     "stream_type": "rtsp"
   }
   ```
4. Test connection and save

### Enabling Chair Tracking

1. Open camera in fullscreen
2. Click **Show Chair Tracking**
3. View real-time occupancy overlays with duration timers

### Creating Panoramic Views

1. Select **Panoramic View** tab
2. Choose 2-6 cameras
3. Click **Create Panorama**
4. Watch automatic stitching

### Person Re-Identification

1. Navigate to **Re-ID** tab
2. Select multiple cameras
3. Click **Start Tracking**
4. Monitor cross-camera movements in timeline

---

## 📚 API Documentation

### Base URL
```
http://localhost:8000/api/v1
```

### Core Endpoints

#### Cameras
```http
GET    /cameras                    # List all cameras
POST   /cameras                    # Add new camera
GET    /cameras/{id}               # Get camera details
DELETE /cameras/{id}               # Delete camera
GET    /cameras/{id}/stream        # Get stream info
GET    /cameras/{id}/detections    # Real-time objects
GET    /cameras/{id}/chair-tracking # Chair occupancy
```

#### AI Service
```http
POST   /caption                    # Generate single caption
POST   /caption/batch              # Multi-frame caption
POST   /detect                     # Object detection
POST   /depth                      # Depth estimation
POST   /embed                      # Text embedding
```

#### Events
```http
GET    /events                     # List events
POST   /events/search              # Semantic search
GET    /events/statistics          # Analytics
```

#### Anomalies
```http
GET    /anomalies                  # List anomalies
POST   /anomaly-detection/rules    # Create rule
GET    /anomalies/notifications    # Alert history
```

### WebSocket Endpoints

```javascript
// Real-time captions
ws://localhost:8000/api/v1/ws/camera/{cameraId}/captions

// Anomaly alerts
ws://localhost:8000/api/v1/ws/alerts
```

---

## 🎨 Frontend Features

### Dashboard
- **Live Stats**: Active cameras, events, anomalies
- **Recent Activity**: Timeline of latest detections
- **System Health**: AI service status, GPU utilization

### Camera Grid
- **Multi-View**: 2x2, 3x3, or 4x4 layouts
- **Live Indicators**: FPS, resolution, uptime
- **Quick Actions**: Fullscreen, settings, delete

### Analytics
- **Event Timeline**: Temporal visualization
- **Heatmaps**: Activity patterns by location/time
- **Search**: Semantic queries across all events

---

## 🔧 Configuration

### Environment Variables

#### Backend (`backend/.env`)
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=yourpassword

REDIS_HOST=localhost
REDIS_PORT=6379

AI_SERVICE_URL=http://localhost:8888
AI_SERVICE_TIMEOUT=60
```

#### AI Service (`cctview-ai-service/.env`)
```env
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxx
CUDA_VISIBLE_DEVICES=0
```

#### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000/api/v1/ws
```

---

## 🔬 Performance Benchmarks

| Operation | Latency | Throughput |
|-----------|---------|------------|
| YOLO Detection | ~50ms | 20 FPS |
| Caption Generation | ~2-3s | - |
| Chair Tracking | ~100ms | 10 FPS |
| Stream Processing | <200ms | 30 FPS |
| Graph Query | ~10ms | 100 qps |

**Hardware**: NVIDIA RTX 3090, 24GB VRAM, Intel i9-12900K

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **NVIDIA** - VILA vision language model API
- **Ultralytics** - YOLOv8 object detection
- **Intel ISL** - MiDaS depth estimation
- **Neo4j** - Graph database technology
- **FastAPI** - Modern Python web framework

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/cctview/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/cctview/discussions)
- **Email**: support@cctview.io

---

<div align="center">

Made with ❤️ by the CCTView Team

[![Stars](https://img.shields.io/github/stars/yourusername/cctview?style=social)](https://github.com/yourusername/cctview)
[![Forks](https://img.shields.io/github/forks/yourusername/cctview?style=social)](https://github.com/yourusername/cctview)
[![Watch](https://img.shields.io/github/watchers/yourusername/cctview?style=social)](https://github.com/yourusername/cctview)

</div>
