import Link from "next/link"

const FOOTER_LINKS = {
  Product: [
    { label: "Scriptwriter", href: "#features" },
    { label: "Breakdown Studio", href: "#features" },
    { label: "Media Library", href: "#features" },
    { label: "Desktop", href: "#features" },
    { label: "Export", href: "#features" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  Legal: [
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Careers", href: "#" },
  ],
}

export function LandingFooter() {
  return (
    <footer
      className="relative px-6 md:px-12 pt-16 pb-8"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div className="max-w-275 mx-auto">
        {/* Links grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {Object.entries(FOOTER_LINKS).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-[12px] font-semibold tracking-widest uppercase mb-4"
                style={{ color: "rgba(255,255,255,0.25)" }}
              >
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] transition-colors duration-200"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.4)")}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          {/* Logo */}
          <span
            className="text-[13px] font-semibold tracking-[0.35em]"
            style={{ color: "rgba(255,255,255,0.15)" }}
          >
            PIECE
          </span>

          {/* Copyright */}
          <p
            className="text-[12px]"
            style={{ color: "rgba(255,255,255,0.2)" }}
          >
            &copy; {new Date().getFullYear()} PIECE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
