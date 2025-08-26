"use client";

// you can tweak these later or move to .env if you want
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Aurora Search";
const TAGLINE  = process.env.NEXT_PUBLIC_APP_TAGLINE || "(your own Perplexity)";
const SUBNOTE  = process.env.NEXT_PUBLIC_APP_SUBNOTE || "presented by Trishul";

const Header = () => {
  return (
    <header className="relative flex items-center justify-between px-8 py-5 bg-gradient-to-r from-[#0EA5E9] to-[#14B8A6] z-10">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20"></div>

      {/* Brand (bigger + bolder now) */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-6 bg-white/90 rounded-full" />
          <span className="font-bold text-white text-2xl tracking-tight">
            {APP_NAME}{" "}
            <span className="font-medium text-white/80">{TAGLINE}</span>
          </span>
        </div>
        <p className="ml-5 mt-1 text-sm font-semibold text-white/90">
          {SUBNOTE}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-1">
        <a className="text-white/90 text-xs px-3 py-1.5 font-medium hover:bg-white/10 rounded-lg transition">
          HOME
        </a>
        <a className="text-white text-xs px-3 py-1.5 font-medium bg-white/15 hover:bg-white/20 rounded-lg transition">
          CHAT
        </a>
        <a className="text-white/90 text-xs px-3 py-1.5 font-medium hover:bg-white/10 rounded-lg transition">
          CONTACTS
        </a>
        <a className="text-white/90 text-xs px-3 py-1.5 font-medium hover:bg-white/10 rounded-lg transition">
          SETTINGS
        </a>
      </nav>
    </header>
  );
};

export default Header;
