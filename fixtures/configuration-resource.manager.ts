import type { ResourceRegistry } from '../api/core/resource-registry';
import type {
  SystemConfigurationInputValue,
  SystemConfigurationSetupService,
  SystemConfigurationUpdateOptions,
} from '../api/setup/system-configuration.setup';

const CONFIGURATION_RESTORE_PRIORITY = 1_000;
type SystemConfigurationUpdater = Pick<
  SystemConfigurationSetupService,
  'updateByName'
>;

export class ConfigurationResourceManager {
  private registrationSequence = 0;

  constructor(
    private readonly resources: ResourceRegistry,
    private readonly systemConfiguration: SystemConfigurationUpdater,
  ) {}

  async updateByName(
    name: string,
    value: SystemConfigurationInputValue,
    options: SystemConfigurationUpdateOptions = {},
  ): Promise<void> {
    await this.updateByNameWithRestore(name, value, options);
  }

  async updateByNameWithRestore(
    name: string,
    value: SystemConfigurationInputValue,
    options: SystemConfigurationUpdateOptions = {},
  ): Promise<() => Promise<void>> {
    const restore = await this.systemConfiguration.updateByName(
      name,
      value,
      options,
    );
    this.registrationSequence += 1;
    const registrationId = `${name}:${this.registrationSequence}`;
    let restored = false;
    const restoreOnce = async (): Promise<void> => {
      if (restored) {
        return;
      }

      await restore();
      restored = true;
    };

    this.resources.register({
      type: 'system-configuration-restore',
      id: registrationId,
      name,
      cleanupPriority:
        CONFIGURATION_RESTORE_PRIORITY + this.registrationSequence,
      cleanup: restoreOnce,
    });

    return async () => {
      await restoreOnce();
      this.resources.markCleaned(
        'system-configuration-restore',
        registrationId,
      );
    };
  }
}
