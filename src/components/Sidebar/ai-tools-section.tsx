import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../stores';

export function AIToolsSection() {
  const { t } = useTranslation();
  const config = useConfigStore((state) => state.config);
  const location = useLocation();

  if (!config || !config.aiTools) {
    return null;
  }

  const aiTools = Object.entries(config.aiTools);

  return (
    <div>
      <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('sidebar.nav.tools')}
      </h2>
      <div className="space-y-0.5">
        {aiTools.map(([key, tool]) => {
          const isActive = location.pathname === `/tools/${key}`;
          return (
            <Link
              key={key}
              to={`/tools/${key}`}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors ${
                isActive
                  ? 'bg-accent text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <span>{tool.name}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  tool.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
