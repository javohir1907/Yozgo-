import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { KeycapLogo } from "@/components/brand/keycap-logo";

/**
 * Extracted from landing.tsx, where the footer lived inside one route and so
 * appeared on exactly one of fourteen pages. Mounted app-wide in App.tsx and
 * hidden on the focus surfaces (/typing-test, /battle).
 */
export function AppFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-muted/30">
      <div className="container mx-auto flex flex-col gap-8 px-4 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-3">
          <KeycapLogo size="sm" />
          <p className="text-sm text-muted-foreground">
            © {year} YOZGO. {t.footer.rights}
          </p>
        </div>

        <div className="flex flex-wrap gap-x-10 gap-y-6">
          <FooterCol label={t.footer.community}>
            <FooterExternal href="https://t.me/yozgo_uz">@yozgo_uz</FooterExternal>
          </FooterCol>
          <FooterCol label={t.footer.support}>
            <FooterExternal href="https://t.me/yozgo_support_bot">
              @yozgo_support_bot
            </FooterExternal>
          </FooterCol>
          <FooterCol label={t.footer.platform}>
            <Link
              href="/leaderboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.footer.rankings}
            </Link>
            <FooterExternal href="https://javohir1907.com">
              {t.footer.founder}: javohir1907
            </FooterExternal>
          </FooterCol>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>
      {children}
    </div>
  );
}

function FooterExternal({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm font-bold text-primary hover:underline"
    >
      {children}
    </a>
  );
}
