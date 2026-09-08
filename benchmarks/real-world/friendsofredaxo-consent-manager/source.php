$table = rex::getTable('consent_manager_cookie');
$msg = '';
$startClangId = rex_clang::getStartId();
$systemCookieUids = ['consent_manager', 'consentmanager'];
$renameOpen = false;
$renameMode = '';
$renameResult = null;
