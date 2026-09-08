    public function registerComponents()
    {
        return [
            ConsentManager::class => 'consentManager',
            CookieManager::class  => 'cookieManager',
            CookieBanner::class   => 'cookieBanner',
        ];
