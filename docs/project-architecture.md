# Project Architecture

```txt
src/
  app/
    router.tsx
    providers.tsx
  components/
    layout/
    ui/
    maps/
    charts/
    forms/
  pages/
    LandingPage.tsx
    auth/
    dashboards/
      HouseholdDashboard.tsx
      BusinessDashboard.tsx
      CollectorDashboard.tsx
      RecyclerDashboard.tsx
      GovernmentDashboard.tsx
      AdminPanel.tsx
  services/
    firebase.ts
    mockApi.ts
    pickupService.ts
    notificationService.ts
  data/
    seed.ts
  hooks/
    useAuth.ts
    usePickups.ts
    useEcoCoins.ts
  store/
    authStore.ts
    uiStore.ts
  types/
    index.ts
  i18n/
    en.ts
    fr.ts
    pidgin.ts
```

RBAC is enforced in route guards and backed by Firebase custom claims for production.
