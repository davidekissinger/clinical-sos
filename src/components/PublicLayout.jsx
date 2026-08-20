import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X, Phone, ArrowRight } from "lucide-react";
import Logo from "@/components/brand/Logo";
import { NAV_LINKS } from "@/lib/siteContent";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="safe-area-top sticky top-0 z-50 border-b border-border/70 bg-white/85 backdrop-blur-md">
        <div className="container-prose flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center" aria-label="Clinical SOS home">
            <Logo />
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.path}
                to={l.path}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-full transition",
                  location.pathname === l.path
                    ? "text-primary bg-accent/60"
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-2">
            <a href="tel:" className="btn-ghost"><Phone className="h-4 w-4" /> Talk With Our Team</a>
            <Link to="/contact" className="btn-primary"><ArrowRight className="h-4 w-4" /> Request a Consultation</Link>
          </div>
          <button className="lg:hidden p-2" onClick={() => setOpen(!open)} aria-label="Toggle menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border bg-white">
            <div className="container-prose py-4 flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.path}
                  to={l.path}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "px-3 py-2.5 text-sm font-medium rounded-lg",
                    location.pathname === l.path ? "text-primary bg-accent/60" : "text-foreground"
                  )}
                >
                  {l.label}
                </Link>
              ))}
              <Link to="/contact" onClick={() => setOpen(false)} className="btn-primary mt-2">Request a Consultation</Link>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="bg-[hsl(263_65%_14%)] text-slate-300">
        <div className="container-prose py-14">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Logo onDark />
              <p className="mt-4 text-sm text-slate-400 max-w-md leading-relaxed">
                Practical consulting support for skilled nursing and long-term care organizations
                facing survey pressure, compliance concerns, operational instability, and
                leadership challenges.
              </p>
              <p className="mt-4 text-sm text-slate-500">Clinical SOS — the public brand of Clinical Advantage Consultants LLC.</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Explore</h4>
              <ul className="space-y-2 text-sm">
                {NAV_LINKS.map((l) => (
                  <li key={l.path}><Link to={l.path} className="text-slate-400 hover:text-white transition">{l.label}</Link></li>
                ))}
                <li><Link to="/rapid-survey-recovery" className="text-slate-400 hover:text-white transition">Rapid Survey Recovery</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Take Action</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/contact" className="text-slate-400 hover:text-white transition">Request a Consultation</Link></li>
                <li><Link to="/contact" className="text-slate-400 hover:text-white transition">Talk With Our Team</Link></li>
                <li><Link to="/services" className="text-slate-400 hover:text-white transition">Our Services</Link></li>
                <li><Link to="/accessibility" className="text-slate-400 hover:text-white transition">Accessibility</Link></li>
                <li><Link to="/login?returnTo=/client" className="text-slate-400 hover:text-white transition">Client Login</Link></li>
                <li><Link to="/login?returnTo=/command-center" className="text-slate-400 hover:text-white transition">Staff Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} Clinical Advantage Consultants LLC. All rights reserved.</p>
            <p>Please do not submit PHI or resident-identifiable information through website forms.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}