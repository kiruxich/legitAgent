            if (acceptBtn) { acceptBtn.click(); } 
            else { Storage.set(CONFIG.storageKey, 'accepted'); Analytics.init(); }
        },
        reject: () => {
            const rejectBtn = document.getElementById('rejectCookiesBtn');
            if (rejectBtn) { rejectBtn.click(); } 
            else { Storage.set(CONFIG.storageKey, 'rejected'); }
