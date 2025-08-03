<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Plus } from '@vben/icons';

import { ElMessage } from 'element-plus';

import {
  acceptFriendRequest,
  cancelFriendRequest,
  getCurrentUserInfo,
  getFriendList,
  getFriendRequests,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from '../../api/friend';

const router = useRouter();

const activeTab = ref('friends');
const searchKeyword = ref('');
const friendsList = ref<any[]>([]);
const sentRequests = ref<any[]>([]);
const receivedRequests = ref<any[]>([]);
const addFriendDialogVisible = ref(false);
const newFriendUsername = ref('');
const currentUserId = ref<null | number>(null);

onMounted(async () => {
  const res = await getCurrentUserInfo();
  currentUserId.value = res.id;
  fetchFriendsList();
  fetchSentRequests();
  fetchReceivedRequests();
});

// 方法
const displayFriendsList = computed(() => {
  const keyword = (searchKeyword.value ?? '').toLowerCase();
  return friendsList.value
    .map((item) => {
      const friendUser =
        item.from_user?.id === currentUserId.value
          ? item.to_user
          : item.from_user;

      return {
        id: item.id, // 关系ID
        userId: friendUser?.id ?? -1, // 对方ID
        username: friendUser?.username ?? '',
      };
    })
    .filter((f) => f.username.toLowerCase().includes(keyword));
});

const handleTabChange = (tab: string) => {
  activeTab.value = tab;
};

const fetchFriendsList = async () => {
  try {
    const response = await getFriendList();
    friendsList.value = response;
  } catch (error) {
    ElMessage.error('获取好友列表失败');
    console.error('Failed to fetch friends list:', error);
  }
};

const fetchSentRequests = async () => {
  try {
    const response = await getFriendRequests('sent');
    sentRequests.value = response;
  } catch (error) {
    ElMessage.error('获取发送的请求失败');
    console.error('Failed to fetch sent requests:', error);
  }
};

const fetchReceivedRequests = async () => {
  try {
    const response = await getFriendRequests('received');
    receivedRequests.value = response;
  } catch (error) {
    ElMessage.error('获取收到的请求失败');
    console.error('Failed to fetch received requests:', error);
  }
};

const openAddFriendDialog = () => {
  newFriendUsername.value = '';
  addFriendDialogVisible.value = true;
};

const addFriend = async () => {
  if (!newFriendUsername.value.trim()) {
    ElMessage.warning('请输入用户名');
    return;
  }
  try {
    // 首先获取用户ID
    const userResponse: {
      id: number;
      username: string;
    }[] = await searchUsers(newFriendUsername.value);
    if (userResponse.length > 0) {
      const userId = userResponse[0]!.id;
      // 发送好友请求
      await sendFriendRequest(userId);
      ElMessage.success('好友请求发送成功');
      addFriendDialogVisible.value = false;
      fetchSentRequests();
    } else {
      ElMessage.error('未找到该用户');
    }
  } catch (error) {
    ElMessage.error('发送好友请求失败');
    console.error('Failed to send friend request:', error);
  }
};

const acceptRequest = async (requestId: number) => {
  try {
    await acceptFriendRequest(requestId);
    ElMessage.success('接受好友请求成功');
    fetchReceivedRequests();
    fetchFriendsList();
  } catch (error) {
    ElMessage.error('接受好友请求失败');
    console.error('Failed to accept friend request:', error);
  }
};

const rejectRequest = async (requestId: number) => {
  try {
    await rejectFriendRequest(requestId);
    ElMessage.success('拒绝好友请求成功');
    fetchReceivedRequests();
  } catch (error) {
    ElMessage.error('拒绝好友请求失败');
    console.error('Failed to reject friend request:', error);
  }
};

const cancelRequest = async (requestId: number) => {
  try {
    await cancelFriendRequest(requestId);
    ElMessage.success('取消好友请求成功');
    fetchSentRequests();
  } catch (error) {
    ElMessage.error('取消好友请求失败');
    console.error('Failed to cancel friend request:', error);
  }
};

const RemoveFriend = async (friendId: number) => {
  try {
    await removeFriend(friendId);
    ElMessage.success('移除好友成功');
    fetchFriendsList();
  } catch (error) {
    ElMessage.error('移除好友失败');
    console.error('Failed to remove friend:', error);
  }
};

const viewFriendDetail = (friendId: number) => {
  router.push({ name: 'FriendDetail', params: { id: friendId } });
};
</script>

<template>
  <div class="friend-manager-container">
    <div class="header">
      <h2>{{ $t('friend.title') }}</h2>
      <el-input
        v-model="searchKeyword"
        :placeholder="$t('friend.search')"
        class="search-input"
        prefix-icon="Search"
        clearable
      />
      <el-button type="primary" @click="openAddFriendDialog" :icon="Plus">
        {{ $t('friend.add') }}
      </el-button>
    </div>

    <el-tabs
      v-model="activeTab"
      class="friend-tabs"
      @tab-change="handleTabChange"
    >
      <el-tab-pane :label="$t('friend.myFriends')" name="friends" />
      <el-tab-pane :label="$t('friend.sentRequests')" name="sent" />
      <el-tab-pane :label="$t('friend.receivedRequests')" name="received" />
    </el-tabs>

    <div class="table-wrapper">
      <!-- 好友列表 -->
      <el-table
        v-if="activeTab === 'friends'"
        :data="displayFriendsList"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="userId" label="ID" width="80" />
        <el-table-column prop="username" :label="$t('friend.username')" />
        <el-table-column
          :label="$t('friend.actions')"
          width="180"
          fixed="right"
        >
          <template #default="scope">
            <el-button
              type="primary"
              size="small"
              @click="viewFriendDetail(scope.row.userId)"
            >
              {{ $t('friend.viewDetail') }}
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="RemoveFriend(scope.row.id)"
            >
              {{ $t('friend.remove') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 已发送请求 -->
      <el-table
        v-else-if="activeTab === 'sent'"
        :data="sentRequests"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="to_user.id" label="ID" width="80" />
        <el-table-column prop="to_user.username" :label="$t('friend.toUser')" />
        <el-table-column prop="created_at" :label="$t('friend.createdAt')" />
        <el-table-column
          prop="status"
          :label="$t('friend.status')"
          width="120"
        />
        <el-table-column
          :label="$t('friend.actions')"
          width="100"
          fixed="right"
        >
          <template #default="scope">
            <el-button
              type="danger"
              size="small"
              @click="cancelRequest(scope.row.id)"
            >
              {{ $t('friend.cancel') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 收到的请求 -->
      <el-table
        v-else
        :data="receivedRequests"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="from_user.id" label="ID" width="80" />
        <el-table-column
          prop="from_user.username"
          :label="$t('friend.fromUser')"
        />
        <el-table-column prop="created_at" :label="$t('friend.createdAt')" />
        <el-table-column
          :label="$t('friend.actions')"
          width="200"
          fixed="right"
        >
          <template #default="scope">
            <el-button
              type="success"
              size="small"
              @click="acceptRequest(scope.row.id)"
            >
              {{ $t('friend.accept') }}
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="rejectRequest(scope.row.id)"
            >
              {{ $t('friend.reject') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加好友对话框 -->
    <el-dialog
      v-model="addFriendDialogVisible"
      :title="$t('friend.add')"
      width="400px"
    >
      <el-input
        v-model="newFriendUsername"
        :placeholder="$t('friend.enterUsername')"
        clearable
      />
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addFriendDialogVisible = false">{{
            $t('common.cancel')
          }}</el-button>
          <el-button type="primary" @click="addFriend">{{
            $t('common.confirm')
          }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.friend-manager-container {
  padding: 24px;
}

.header {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
}

.search-input {
  width: 260px;
}

.friend-tabs {
  margin-bottom: 16px;
}

.table-wrapper {
  min-height: 300px;
}

.dialog-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
