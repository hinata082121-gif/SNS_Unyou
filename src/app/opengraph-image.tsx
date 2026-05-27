import { ImageResponse } from "next/og";

export const alt = "ICHI Social";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#ffffff",
          color: "#0a0a0a",
          padding: "64px",
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "2px solid #0a0a0a",
            borderRadius: "28px",
            padding: "56px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div
              style={{
                display: "flex",
                color: "#525252",
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              小規模事業者向けSNS運用パートナー
            </div>
            <div style={{ fontSize: 92, fontWeight: 900 }}>
              ICHI Social
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "2px solid #e5e5e5",
              paddingTop: "36px",
              fontSize: 42,
              fontWeight: 900,
            }}
          >
            <span>SNS運用を、止めない。</span>
            <span style={{ color: "#737373", fontSize: 28 }}>
              Planning / Report / Review
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
