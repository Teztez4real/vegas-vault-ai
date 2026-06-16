"use client";
import React, { useState } from "react";

// ── NAV SECTIONS (matches existing 9 sections in VegasVaultApp) ──────────────
const NAV_SECTIONS = [
  { key: "dashboard",     label: "Dashboard",     icon: "ti-layout-dashboard" },
  { key: "aichat",        label: "AI Chat",        icon: "ti-message-circle" },
  { key: "models",        label: "Models",         icon: "ti-cube" },
  { key: "memory",        label: "Memory",         icon: "ti-server" },
  { key: "agents",        label: "Agents",         icon: "ti-users" },
  { key: "vault",         label: "Vault",          icon: "ti-shield" },
  { key: "analytics",     label: "Analytics",      icon: "ti-chart-bar" },
  { key: "slate",         label: "Games Slate",    icon: "ti-ball-baseball" },
  { key: "settings",      label: "Settings",       icon: "ti-settings" },
];

// ── SPORT ACCENT COLORS (matches existing SPORT_ACCENT map) ──────────────────
export const SPORT_ACCENT = {
  MLB:    "#3b82f6",
  NBA:    "#f97316",
  NFL:    "#22c55e",
  Tennis: "#a78bfa",
  WNBA:   "#f472b6",
  ALL:    "#64748b",
};

// ── SIDEBAR BRAND ─────────────────────────────────────────────────────────────
function SidebarBrand() {
  return (
    <div className="vv-sb-brand">
      <div className="vv-sb-hex">
        <span className="vv-sb-ai">AI</span>
      </div>
      <div className="vv-sb-name">VEGAS VAULT AI</div>
      <div className="vv-sb-sub">AI Model OS</div>
    </div>
  );
}

// ── SIDEBAR USER CARD ─────────────────────────────────────────────────────────
function SidebarUser({ userName, isAdmin, onClick }) {
  return (
    <div className="vv-sb-user" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="vv-sb-av"><i className="ti ti-user" /></div>
      <div>
        <div className="vv-sb-uname">{userName || "Member"}</div>
        <div className={`vv-sb-urole ${isAdmin ? "admin" : "member"}`}>
          {isAdmin ? "Admin" : "Premium Member"}
        </div>
      </div>
      <i className="ti ti-chevron-right vv-sb-chev" />
    </div>
  );
}

// ── SIDEBAR NAV ───────────────────────────────────────────────────────────────
function SidebarNav({ activeSection, onNavigate }) {
  return (
    <>
      {NAV_SECTIONS.map(s => {
        const isActive = activeSection === s.key;
        return (
          <div
            key={s.key}
            className={`vv-nb${isActive ? " active" : ""}`}
            onClick={() => onNavigate(s.key)}
          >
            <i className={`ti ${s.icon}`} />
            {s.label}
            {isActive && (
              <span className="vv-nb-arr"><i className="ti ti-chevron-right" /></span>
            )}
          </div>
        );
      })}
    </>
  );
}

// ── SIDEBAR STATUS ────────────────────────────────────────────────────────────
function SidebarStatus() {
  return (
    <div className="vv-sb-status">
      <div className="vv-ss-label">System Status</div>
      <div className="vv-ss-val">OPTIMAL</div>
      <div className="vv-ss-sub">All systems operational</div>
    </div>
  );
}

// ── NEURAL BACKGROUND ─────────────────────────────────────────────────────────
function NeuralBg() {
  return (
    <svg className="vv-neural" viewBox="0 0 1400 920" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="vv-ng" cx="48%" cy="48%" r="52%">
          <stop offset="0%" stopColor="rgba(57,255,20,0.05)" />
          <stop offset="100%" stopColor="rgba(57,255,20,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="650" cy="440" rx="560" ry="360" fill="url(#vv-ng)" />
      <g stroke="rgba(57,255,20,0.05)" strokeWidth="0.6" fill="none">
        <line x1="80"  y1="160" x2="280" y2="260" />
        <line x1="280" y1="260" x2="500" y2="190" />
        <line x1="500" y1="190" x2="700" y2="310" />
        <line x1="700" y1="310" x2="920" y2="210" />
        <line x1="150" y1="440" x2="400" y2="390" />
        <line x1="400" y1="390" x2="600" y2="460" />
        <line x1="600" y1="460" x2="820" y2="400" />
      </g>
      <g fill="rgba(57,255,20,0.16)">
        <circle cx="280" cy="260" r="2.5" />
        <circle cx="500" cy="190" r="2" />
        <circle cx="700" cy="310" r="3" />
        <circle cx="400" cy="390" r="2.5" />
        <circle cx="600" cy="460" r="2" />
        <circle cx="820" cy="400" r="2.5" />
      </g>
    </svg>
  );
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
function Topbar({ onMenuToggle, hasNotification }) {
  return (
    <div className="vv-topbar">
      <div className="vv-menu-toggle" onClick={onMenuToggle} aria-label="Open navigation menu">
        <i className="ti ti-menu-2" />
      </div>
      <div className="vv-tb-search">
        <i className="ti ti-search" />
        <input type="text" placeholder="Ask Vegas Vault AI anything..." />
        <button className="vv-go-btn">
          <i className="ti ti-arrow-right" style={{ fontSize: 13, color: "#111" }} />
        </button>
      </div>
      <div className="vv-tb-spacer" />
      <div className="vv-tb-icons">
        <div className="vv-tbi">
          <i className="ti ti-bell" />
          {hasNotification && <span className="dot" />}
        </div>
        <div className="vv-tbi green">
          <i className="ti ti-sparkles" />
        </div>
      </div>
    </div>
  );
}

// ── SHELL LAYOUT (main export) ────────────────────────────────────────────────
export default function NewLookShell({
  children,
  activeSection = "dashboard",
  onNavigate,
  userName,
  isAdmin,
  hasNotification = false,
  authed = true,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer  = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const handleNavigate = (key) => {
    onNavigate?.(key);
    closeDrawer();
  };

  if (!authed) {
    return (
      <div className="vv-root">
        <NeuralBg />
        <div className="vv-main vv-main-unauth">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="vv-root">
      <NeuralBg />

      {/* Topbar */}
      <Topbar onMenuToggle={openDrawer} hasNotification={hasNotification} />

      {/* Mobile scrim + drawer */}
      <div className={`vv-scrim${drawerOpen ? " open" : ""}`} onClick={closeDrawer} />
      <div className={`vv-drawer${drawerOpen ? " open" : ""}`}>
        <i className="ti ti-x vv-drawer-close" onClick={closeDrawer} />
        <SidebarBrand />
        <SidebarNav activeSection={activeSection} onNavigate={handleNavigate} />
        <SidebarStatus />
        <SidebarUser userName={userName} isAdmin={isAdmin} onClick={() => handleNavigate('settings')} />
      </div>

      {/* Body */}
      <div className="vv-body">
        {/* Desktop sidebar */}
        <div className="vv-sidebar">
          <SidebarBrand />
          <SidebarNav activeSection={activeSection} onNavigate={handleNavigate} />
          <SidebarStatus />
          <SidebarUser userName={userName} isAdmin={isAdmin} onClick={() => handleNavigate('settings')} />
        </div>

        {/* Page content */}
        <div className="vv-main">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── NAMED EXPORTS for reuse across page components ────────────────────────────
export { NAV_SECTIONS, SidebarBrand, SidebarUser, SidebarNav, SidebarStatus, NeuralBg, Topbar };
