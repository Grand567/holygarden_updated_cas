window.switchTeacherCasMode = function(mode) {
    window._currentTeacherCasMode = mode;
    const cdcTab = document.getElementById('tab-cas-cdc');
    const weeklyTab = document.getElementById('tab-cas-weekly');
    const cdcFilters = document.getElementById('cas-cdc-filters');
    
    if (mode === 'cdc') {
        cdcTab.classList.add('active');
        cdcTab.style.borderBottom = '2px solid var(--primary)';
        cdcTab.style.color = 'var(--primary)';
        cdcTab.style.fontWeight = '700';
        
        weeklyTab.classList.remove('active');
        weeklyTab.style.borderBottom = 'none';
        weeklyTab.style.color = 'var(--text-muted)';
        weeklyTab.style.fontWeight = '500';
        
        cdcFilters.style.display = 'flex';
    } else {
        weeklyTab.classList.add('active');
        weeklyTab.style.borderBottom = '2px solid var(--primary)';
        weeklyTab.style.color = 'var(--primary)';
        weeklyTab.style.fontWeight = '700';
        
        cdcTab.classList.remove('active');
        cdcTab.style.borderBottom = 'none';
        cdcTab.style.color = 'var(--text-muted)';
        cdcTab.style.fontWeight = '500';
        
        cdcFilters.style.display = 'none';
    }
    window.loadTeacherCASData();
};

