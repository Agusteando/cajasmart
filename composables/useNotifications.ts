export function useNotifications() {
  const items = ref<any[]>([]);
  const unread = ref(0);

  async function fetchUnread() {
    const res = await $fetch<{ unread: number }>('/api/notifications/unread-count');
    unread.value = res.unread;
  }

  async function fetchList(unreadOnly = false) {
    items.value = await $fetch('/api/notifications', { params: unreadOnly ? { unread: 1 } : {} });
  }

  async function markRead(id: number) {
    await $fetch('/api/notifications/read', { method: 'POST', body: { id } });
    await fetchUnread();
  }

  async function markAllRead() {
    await $fetch('/api/notifications/read', { method: 'POST', body: { all: true } });
    await fetchUnread();
  }

  return { items, unread, fetchUnread, fetchList, markRead, markAllRead };
}
