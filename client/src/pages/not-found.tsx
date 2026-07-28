import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { EmptyState } from "@/components/common/empty-state";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <PageShell size="sm" seo={{ title: t.notFound.title, noindex: true }}>
      <EmptyState
        icon={AlertCircle}
        title={`404 — ${t.notFound.title}`}
        description={t.notFound.description}
        action={
          <Button asChild variant="outline" data-testid="link-go-home">
            <Link href="/">{t.notFound.home}</Link>
          </Button>
        }
      />
    </PageShell>
  );
}
