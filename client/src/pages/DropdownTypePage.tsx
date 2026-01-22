import { Redirect, useRoute } from 'wouter';
import { GenericDropdownManagement } from '@/components/settings/GenericDropdownManagement';
import { dropdownConfigs } from '@/components/settings/dropdownConfigs';

export default function DropdownTypePage() {
  const [, params] = useRoute('/admin/dropdowns/:type');
  const type = params?.type;

  const config = type ? dropdownConfigs[type] : null;

  if (!config) {
    // Redirect to hub if invalid type
    return <Redirect to="/admin/dropdowns" />;
  }

  return <GenericDropdownManagement config={config} />;
}
