<template>
  <div class="leagues-page">
    <div class="container">
      <header class="page-masthead">
        <div class="masthead-title">
          <h1 class="page-title">Leagues</h1>
          <p class="page-description">
            Show your friends you know ball way better than them
          </p>
        </div>
      </header>

      <div class="tab-switch">
        <button
          @click="activeTab = 'friends'"
          :class="{ active: activeTab === 'friends' }"
          class="tab-chip"
        >
          Friends' Bets
        </button>
        <button
          @click="activeTab = 'management'"
          :class="{ active: activeTab === 'management' }"
          class="tab-chip"
        >
          Management
        </button>
      </div>

      <div class="tab-content">
        <FriendsBets v-if="activeTab === 'friends'" />
        <LeagueManagement v-if="activeTab === 'management'" />
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import LeagueManagement from './LeagueManagement.vue'
import FriendsBets from './FriendsBets.vue'

export default {
  name: 'LeaguesPage',
  components: {
    LeagueManagement,
    FriendsBets
  },
  setup() {
    const activeTab = ref('friends')

    return {
      activeTab
    }
  }
}
</script>

<style scoped>
.leagues-page {
  min-height: 100vh;
  background: var(--color-bg);
  padding-bottom: var(--space-12);
}

/* Masthead, ledger band and section heads are the betting dashboard's; this
   page reads as the same publication rather than its own thing. */
.page-masthead {
  padding: var(--space-8) 0 var(--space-5);
}

.masthead-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.page-title {
  margin: 0;
  font-size: var(--text-display);
  line-height: 1;
  color: var(--color-text);
}

.page-description {
  margin: 0;
  font-family: var(--font-display);
  font-style: italic;
  font-size: var(--text-xl);
  color: var(--color-text-muted);
}

/* Same switch as the board's league chips. Two tabs don't need the full page
   width - the group hugs its buttons. */
.tab-switch {
  display: inline-flex;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-surface);
  margin-bottom: var(--space-4);
}

.tab-chip {
  padding: var(--space-2) var(--space-5);
  border: none;
  border-left: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.tab-chip:first-child { border-left: none; }

.tab-chip:hover { background: var(--color-surface-muted); color: var(--color-text); }

.tab-chip.active {
  background: var(--color-text);
  color: var(--color-text-inverse);
  font-weight: 600;
}

.tab-content {
  min-height: 320px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tab-content :deep(.league-management),
.tab-content :deep(.friends-bets) {
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  margin-bottom: 0;
}

@media (max-width: 768px) {
  .page-masthead {
    padding: var(--space-6) 0 var(--space-4);
  }

  .page-title {
    font-size: var(--text-3xl);
  }

  .page-description {
    font-size: var(--text-base);
  }

  .tab-switch {
    display: flex;
    width: 100%;
  }

  .tab-chip {
    flex: 1;
    padding: var(--space-2) var(--space-3);
  }
}
</style>
