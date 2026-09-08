const hooks = require('./pluginfw/hooks');
import {showPrivacyBannerIfEnabled} from './privacy_banner';
import {maybeShowOutdatedNotice} from './pad_outdated_notice';
      showDeletionTokenModalIfPresent();
      showPrivacyBannerIfEnabled((clientVars as any).privacyBanner);
      void maybeShowOutdatedNotice();
