import { useState, useEffect, useRef } from "react";

const RIDERS = [
  { id: 1, name: "Youssef K.", status: "available", lat: 35.7595, lng: -5.8340, deliveries: 147, earnings: 2352 },
  { id: 2, name: "Hamza M.", status: "busy", lat: 35.7721, lng: -5.8156, deliveries: 203, earnings: 3248 },
  { id: 3, name: "Amine B.", status: "available", lat: 35.7498, lng: -5.8512, deliveries: 89, earnings: 1424 },
  { id: 4, name: "Tariq O.", status: "busy", lat: 35.7643, lng: -5.8089, deliveries: 312, earnings: 5192 },
  { id: 5, name: "Bilal R.", status: "available", lat: 35.7812, lng: -5.8267, deliveries: 56, earnings: 896 },
  { id: 6, name: "Khalid S.", status: "offline", lat: 35.7534, lng: -5.8423, deliveries: 178, earnings: 2848 },
  { id: 7, name: "Omar F.", status: "busy", lat: 35.7689, lng: -5.8178, deliveries: 94, earnings: 1504 },
];

const DELIVERIES = [
  { id: "D-0091", business: "Pharmacie Atlas", rider: "Hamza M.", from: "Rue Ibn Batouta", to: "Av. Mohammed V", status: "in_transit", duration: "24 min", amount: 32 },
  { id: "D-0090", business: "Boulangerie Zitoun", rider: "Tariq O.", from: "Hay Karima", to: "Centre Ville", status: "picked_up", duration: "18 min", amount: 24 },
  { id: "D-0089", business: "Bureau COGEMA", rider: "Omar F.", from: "Zone Industrielle", to: "Port Tanger", status: "in_transit", duration: "31 min", amount: 40 },
  { id: "D-0088", business: "Café Riad", rider: "Youssef K.", from: "Médina", to: "Malabata", status: "delivered", duration: "22 min", amount: 28 },
  { id: "D-0087", business: "Optique Lumière", rider: "Amine B.", from: "Rue de Fès", to: "Tanger City Center", status: "delivered", duration: "15 min", amount: 20 },
  { id: "D-0086", business: "Cabinet Dental", rider: "Hamza M.", from: "Av. Youssef Ibn Tachfine", to: "Ancien Marché", status: "pending", duration: "—", amount: 36 },
];

const BUSINESSES = [
  { name: "Pharmacie Atlas", plan: "annual", rides_left: 64, wallet: 340, deliveries: 28 },
  { name: "Boulangerie Zitoun", plan: "monthly", rides_left: 3, wallet: 180, deliveries: 12 },
  { name: "Bureau COGEMA", plan: "annual", rides_left: 81, wallet: 620, deliveries: 7 },
  { name: "Café Riad", plan: "monthly", rides_left: 6, wallet: 90, deliveries: 19 },
  { name: "Optique Lumière", plan: "monthly", rides_left: 8, wallet: 0, deliveries: 5 },
];

const statusColors = {
  available: "#00FF88",
  busy: "#FF3B3B",
  offline: "#555566",
};

const deliveryStatusConfig = {
  pending: { label: "En attente", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  picked_up: { label: "Récupéré", color: "#60A5FA", bg: "rgba(96,165,250,0.12)" },
  in_transit: { label: "En route", color: "#00FF88", bg: "rgba(0,255,136,0.12)" },
  delivered: { label: "Livré", color: "#888899", bg: "rgba(136,136,153,0.12)" },
};

function PulsingDot({ color, size = 10 }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: "absolute", inset: 0, borderRadius: "50%",
        backgroundColor: color, opacity: 0.3,
        animation: color === "#00FF88" ? "ping 1.5s ease-out infinite" : "none",
      }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: color }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16,
      padding: "20px 24px",
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, borderRadius: "16px 16px 0 0" }} />
      <span style={{ fontSize: 12, color: "#666677", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: "#F0F0F8", fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: accent, fontFamily: "'DM Sans', sans-serif" }}>{sub}</span>}
    </div>
  );
}

function MapSimulation({ riders, selectedRider, onSelectRider }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const posRef = useRef(riders.map(r => ({ ...r, vx: (Math.random() - 0.5) * 0.0002, vy: (Math.random() - 0.5) * 0.0002 })));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;

    function draw() {
      frame++;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const W = canvas.width, H = canvas.height;

      // Background
      ctx.fillStyle = "#0D0D14";
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Street-like lines
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 2;
      [[0.3, 0, 0.7, 1], [0, 0.4, 1, 0.6], [0.1, 0, 0.5, 1], [0, 0.2, 1, 0.8]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath(); ctx.moveTo(x1 * W, y1 * H); ctx.lineTo(x2 * W, y2 * H); ctx.stroke();
      });

      // Update positions for busy riders
      posRef.current = posRef.current.map(r => {
        if (r.status !== "busy") return r;
        let nx = r.lat + r.vx;
        let ny = r.lng + r.vy;
        if (nx > 35.79 || nx < 35.74) r.vx *= -1;
        if (ny > -5.80 || ny < -5.86) r.vy *= -1;
        return { ...r, lat: nx, lng: ny };
      });

      // Map lat/lng to canvas coords
      const toX = (lng) => ((lng - (-5.86)) / 0.06) * W;
      const toY = (lat) => ((35.79 - lat) / 0.05) * H;

      // Draw routes for busy riders
      posRef.current.filter(r => r.status === "busy").forEach(r => {
        const x = toX(r.lng), y = toY(r.lat);
        ctx.strokeStyle = "rgba(255,59,59,0.15)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 50 + Math.sin(frame * 0.02 + r.id) * 20, y - 30);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Draw riders
      posRef.current.forEach(r => {
        const x = toX(r.lng), y = toY(r.lat);
        const color = statusColors[r.status];
        const isSelected = selectedRider === r.id;

        // Pulse ring for available
        if (r.status === "available") {
          const pulseSize = 16 + Math.sin(frame * 0.05 + r.id) * 6;
          ctx.beginPath();
          ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,255,136,${0.15 + Math.sin(frame * 0.05 + r.id) * 0.1})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Selection ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Main dot
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Motorcycle icon (simple arrow showing direction)
        if (r.status === "busy") {
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "10px Arial";
          ctx.fillText("🏍", x - 5, y - 14);
        }

        // Label
        ctx.fillStyle = "rgba(240,240,248,0.9)";
        ctx.font = isSelected ? "bold 11px 'DM Sans', sans-serif" : "11px 'DM Sans', sans-serif";
        ctx.fillText(r.name.split(" ")[0], x + 12, y + 4);
      });

      // Tanger label
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "bold 11px 'DM Sans', sans-serif";
      ctx.letterSpacing = "0.15em";
      ctx.fillText("TANGER", 16, H - 16);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [selectedRider]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair", borderRadius: 12 }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const toX = (lng) => ((lng - (-5.86)) / 0.06) * W;
        const toY = (lat) => ((35.79 - lat) / 0.05) * H;
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const clicked = riders.find(r => {
          const rx = toX(r.lng), ry = toY(r.lat);
          return Math.hypot(rx - mx, ry - my) < 20;
        });
        onSelectRider(clicked ? clicked.id : null);
      }}
    />
  );
}

export default function The1000Admin() {
  const [activeTab, setActiveTab] = useState("map");
  const [selectedRider, setSelectedRider] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const available = RIDERS.filter(r => r.status === "available").length;
  const busy = RIDERS.filter(r => r.status === "busy").length;
  const activeDeliveries = DELIVERIES.filter(d => d.status === "in_transit" || d.status === "picked_up").length;
  const todayRevenue = DELIVERIES.filter(d => d.status === "delivered").reduce((s, d) => s + d.amount, 0);
  const selectedRiderData = RIDERS.find(r => r.id === selectedRider);

  const tabs = ["map", "livraisons", "riders", "business"];
  const tabLabels = { map: "Carte Live", livraisons: "Livraisons", riders: "Riders", business: "Business" };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0A0A12",
      color: "#F0F0F8",
      fontFamily: "'DM Sans', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');
        @keyframes ping { 0% { transform: scale(1); opacity: 0.4; } 75% { transform: scale(2.5); opacity: 0; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* TOP BAR */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 28px", height: 60,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(10,10,18,0.95)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #00FF88, #00CC6A)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 16 }}>🏍</span>
          </div>
          <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em" }}>
            THE <span style={{ color: "#00FF88" }}>1000</span>
          </span>
          <span style={{
            fontSize: 10, color: "#00FF88", background: "rgba(0,255,136,0.1)",
            border: "1px solid rgba(0,255,136,0.2)", borderRadius: 4,
            padding: "2px 8px", fontWeight: 600, letterSpacing: "0.1em",
          }}>ADMIN</span>
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? "rgba(0,255,136,0.1)" : "transparent",
              border: activeTab === tab ? "1px solid rgba(0,255,136,0.25)" : "1px solid transparent",
              color: activeTab === tab ? "#00FF88" : "#888899",
              padding: "6px 16px", borderRadius: 8, cursor: "pointer",
              fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
              transition: "all 0.15s",
            }}>{tabLabels[tab]}</button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 600, color: "#F0F0F8" }}>
              {currentTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
            <div style={{ fontSize: 11, color: "#555566" }}>
              {currentTime.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #1A1A2E, #2E2E4E)",
            border: "2px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, cursor: "pointer",
          }}>I</div>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16, padding: "20px 28px 0",
        animation: "fadeIn 0.4s ease",
      }}>
        <StatCard label="Riders Disponibles" value={available} sub={`${busy} en course · ${RIDERS.filter(r => r.status === "offline").length} hors ligne`} accent="#00FF88" />
        <StatCard label="Livraisons Actives" value={activeDeliveries} sub="En cours maintenant" accent="#60A5FA" />
        <StatCard label="Revenus Aujourd'hui" value={`${todayRevenue} MAD`} sub="Livraisons complétées" accent="#F59E0B" />
        <StatCard label="Business Actifs" value={BUSINESSES.length} sub="Sur plateforme" accent="#A78BFA" />
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, padding: "20px 28px 28px", animation: "fadeIn 0.3s ease" }}>

        {/* MAP TAB */}
        {activeTab === "map" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, height: "calc(100vh - 240px)" }}>
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 16, overflow: "hidden", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 10,
                display: "flex", gap: 8,
              }}>
                {[
                  { color: "#00FF88", label: `${available} disponibles` },
                  { color: "#FF3B3B", label: `${busy} en course` },
                  { color: "#555566", label: "hors ligne" },
                ].map(({ color, label }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(10,10,18,0.85)", backdropFilter: "blur(8px)",
                    padding: "4px 10px", borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 11, color: "#CCCCDD",
                  }}>
                    <PulsingDot color={color} size={8} />
                    {label}
                  </div>
                ))}
              </div>
              <MapSimulation riders={RIDERS} selectedRider={selectedRider} onSelectRider={setSelectedRider} />
            </div>

            {/* SIDE PANEL */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
              {selectedRiderData ? (
                <div style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${statusColors[selectedRiderData.status]}44`,
                  borderRadius: 16, padding: 20,
                  animation: "fadeIn 0.2s ease",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18 }}>{selectedRiderData.name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <PulsingDot color={statusColors[selectedRiderData.status]} size={8} />
                        <span style={{ fontSize: 12, color: statusColors[selectedRiderData.status], textTransform: "capitalize" }}>
                          {selectedRiderData.status === "available" ? "Disponible" : selectedRiderData.status === "busy" ? "En course" : "Hors ligne"}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedRider(null)} style={{
                      background: "rgba(255,255,255,0.06)", border: "none", color: "#888899",
                      width: 28, height: 28, borderRadius: 8, cursor: "pointer", fontSize: 14,
                    }}>×</button>
                  </div>
                  {[
                    ["Livraisons ce mois", selectedRiderData.deliveries],
                    ["Gains estimés", `${selectedRiderData.earnings} MAD`],
                    ["Commission due", `${Math.max(0, selectedRiderData.deliveries - 20) * 3} MAD`],
                    ["À payer", `${selectedRiderData.earnings - Math.max(0, selectedRiderData.deliveries - 20) * 3} MAD`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 13, color: "#666677" }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                  <button style={{
                    marginTop: 16, width: "100%", padding: "10px",
                    background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)",
                    color: "#00FF88", borderRadius: 10, cursor: "pointer",
                    fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                  }}>Marquer paiement effectué</button>
                </div>
              ) : (
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 16, padding: 16,
                }}>
                  <div style={{ fontSize: 11, color: "#555566", marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Riders en temps réel</div>
                  {RIDERS.map(r => (
                    <div key={r.id} onClick={() => setSelectedRider(r.id)} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                      transition: "background 0.15s",
                      background: "transparent",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <PulsingDot color={statusColors[r.status]} size={10} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                        <div style={{ fontSize: 11, color: "#555566" }}>{r.deliveries} livraisons · {r.earnings} MAD</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#444455" }}>→</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ACTIVE DELIVERIES */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16 }}>
                <div style={{ fontSize: 11, color: "#555566", marginBottom: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Livraisons actives</div>
                {DELIVERIES.filter(d => d.status !== "delivered").slice(0, 4).map(d => {
                  const sc = deliveryStatusConfig[d.status];
                  return (
                    <div key={d.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{d.business}</span>
                        <span style={{ fontSize: 11, color: sc.color, background: sc.bg, padding: "2px 8px", borderRadius: 20 }}>{sc.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#555566" }}>{d.rider} · {d.duration} · {d.amount} MAD</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* LIVRAISONS TAB */}
        {activeTab === "livraisons" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>Toutes les livraisons</span>
              <span style={{ fontSize: 12, color: "#555566" }}>{DELIVERIES.length} aujourd'hui</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["ID", "Business", "Rider", "Départ", "Arrivée", "Durée", "Statut", "Montant"].map(h => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: "#555566", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DELIVERIES.map((d, i) => {
                  const sc = deliveryStatusConfig[d.status];
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td style={{ padding: "14px 20px", fontSize: 13, fontFamily: "'Syne', sans-serif", color: "#888899" }}>{d.id}</td>
                      <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 500 }}>{d.business}</td>
                      <td style={{ padding: "14px 20px", fontSize: 13, color: "#AAAACC" }}>{d.rider}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: "#666677" }}>{d.from}</td>
                      <td style={{ padding: "14px 20px", fontSize: 12, color: "#666677" }}>{d.to}</td>
                      <td style={{ padding: "14px 20px", fontSize: 13 }}>{d.duration}</td>
                      <td style={{ padding: "14px 20px" }}>
                        <span style={{ fontSize: 12, color: sc.color, background: sc.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: "14px 20px", fontSize: 13, fontWeight: 600, color: "#00FF88" }}>{d.amount} MAD</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* RIDERS TAB */}
        {activeTab === "riders" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {RIDERS.map(r => (
              <div key={r.id} style={{
                background: "rgba(255,255,255,0.02)", border: `1px solid ${statusColors[r.status]}22`,
                borderRadius: 16, padding: 20, position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: statusColors[r.status], opacity: 0.5 }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{r.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <PulsingDot color={statusColors[r.status]} size={8} />
                      <span style={{ fontSize: 12, color: statusColors[r.status] }}>
                        {r.status === "available" ? "Disponible" : r.status === "busy" ? "En course" : "Hors ligne"}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `${statusColors[r.status]}15`,
                    border: `1px solid ${statusColors[r.status]}30`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>🏍</div>
                </div>
                {[
                  ["Livraisons", r.deliveries],
                  ["Gains bruts", `${r.earnings} MAD`],
                  ["Commission", `${Math.max(0, r.deliveries - 20) * 3} MAD`],
                  ["Net à payer", `${r.earnings - Math.max(0, r.deliveries - 20) * 3} MAD`],
                ].map(([l, v]) => (
                  <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 12, color: "#666677" }}>{l}</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* BUSINESS TAB */}
        {activeTab === "business" && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 16 }}>Businesses abonnés</span>
              <button style={{
                background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.25)",
                color: "#00FF88", padding: "6px 16px", borderRadius: 8, cursor: "pointer",
                fontSize: 12, fontFamily: "'DM Sans', sans-serif",
              }}>+ Ajouter crédits</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Business", "Plan", "Rides restants", "Wallet", "Livraisons ce mois", "Actions"].map(h => (
                    <th key={h} style={{ padding: "12px 20px", textAlign: "left", fontSize: 11, color: "#555566", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BUSINESSES.map((b, i) => (
                  <tr key={b.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "14px 20px", fontSize: 14, fontWeight: 600 }}>{b.name}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{
                        fontSize: 11, padding: "3px 10px", borderRadius: 20,
                        color: b.plan === "annual" ? "#A78BFA" : "#60A5FA",
                        background: b.plan === "annual" ? "rgba(167,139,250,0.1)" : "rgba(96,165,250,0.1)",
                      }}>{b.plan === "annual" ? "Annuel" : "Mensuel"}</span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: b.rides_left <= 2 ? "#FF3B3B" : "#F0F0F8", fontWeight: 600 }}>{b.rides_left}</span>
                      <span style={{ fontSize: 11, color: "#555566" }}> / {b.plan === "annual" ? 96 : 8}</span>
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 13, color: b.wallet === 0 ? "#555566" : "#00FF88", fontWeight: 600 }}>{b.wallet} MAD</td>
                    <td style={{ padding: "14px 20px", fontSize: 13 }}>{b.deliveries}</td>
                    <td style={{ padding: "14px 20px" }}>
                      <button style={{
                        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                        color: "#AAAACC", padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                        fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                      }}>Gérer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
