import { useRole } from '../context/RoleContext';

export function SharedLinksPage() {
  const { t } = useRole();
  return (
    <div className="flex-1 p-6 bg-[#fafafa]">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">{t('page_shared_links')}</h1>
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-gray-500 mb-4">{t('page_shared_links_placeholder')}</div>
        </div>
      </div>
    </div>
  );
}
