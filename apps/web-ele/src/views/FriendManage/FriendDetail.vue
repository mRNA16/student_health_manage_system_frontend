<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { ElMessage } from 'element-plus';

import {
  removeFriend as apiRemoveFriend,
  fetchComments,
  fetchFriendDetail,
  submitComment as SubmitComment,
} from '../../api/friend';

// 定义Friend接口
interface Friend {
  id: number;
  username: string;
}

type Comment = {
  content: string;
  id: number;
  username: string;
};

type Activity = {
  comments: Comment[];
  content: string;
  id: number;
  newComment?: string; // 可选字段，用于前端输入
  timestamp: string;
  type: 'meal' | 'sleep' | 'sport';
};

const friend = ref<Friend>({ id: 0, username: '' });
const activities = ref<any[]>([]);

// 路由和导航
const route = useRoute();
const router = useRouter();
const friendId = Number(route.params.id);

// 格式化日期
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// 获取好友详情
const getFriendDetail = async () => {
  try {
    const response = await fetchFriendDetail(friendId);
    friend.value.id = response.id;
    friend.value.username = response.username;
    activities.value = response.activities || [];
    for (const activity of activities.value) {
      activity.comments = [];
      activity.newComment = '';
      await loadComments(activity);
    }
  } catch (error) {
    ElMessage.error('获取好友详情失败');
    console.error('Failed to fetch friend detail:', error);
  }
};

// 移除好友
const removeFriend = async () => {
  try {
    await apiRemoveFriend(friendId);
    ElMessage.success('好友移除成功');
    router.push({ name: 'friendManager' });
  } catch (error) {
    ElMessage.error('移除好友失败');
    console.error('Failed to remove friend:', error);
  }
};

const loadComments = async (activity: Activity) => {
  try {
    const res = await fetchComments(activity.type, activity.id);
    activity.comments = res.map((item) => ({
      id: item.id,
      username: item.username,
      content: item.content,
    }));
  } catch {
    activity.comments = [];
  }
};

const submitComment = async (activity: Activity) => {
  if (!activity.newComment!.trim()) return;
  try {
    await SubmitComment(activity.type, activity.id, activity.newComment!);
    ElMessage.success('评论成功');
    activity.newComment = '';
    await loadComments(activity);
  } catch {
    ElMessage.error('评论失败');
  }
};
// 组件挂载时获取数据
onMounted(() => {
  getFriendDetail();
});
</script>

<template>
  <div class="friend-detail-container">
    <div class="friend-header">
      <div class="friend-info">
        <h2 class="friend-name">{{ friend.username }}</h2>
      </div>
      <div class="action-buttons">
        <el-button type="danger" @click="removeFriend">移除好友</el-button>
      </div>
    </div>

    <div class="friend-activity">
      <h3 class="section-title">最近活动</h3>
      <div v-if="activities.length > 0" class="activity-list">
        <div
          v-for="activity in activities"
          :key="`${activity.type}-${activity.id}`"
          class="activity-item"
        >
          <div class="activity-type">{{ activity.type }}</div>
          <div class="activity-content">{{ activity.content }}</div>
          <div class="activity-time">{{ formatDate(activity.timestamp) }}</div>
          <div class="comments">
            <div
              v-for="comment in activity.comments"
              :key="comment.id"
              class="comment-item"
            >
              <strong>{{ comment.username }}:</strong> {{ comment.content }}
            </div>
            <div class="comment-form">
              <el-input
                v-model="activity.newComment"
                placeholder="写下你的评论..."
                size="small"
                clearable
              />
              <el-button
                size="small"
                type="primary"
                @click="submitComment(activity)"
              >
                发送
              </el-button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="no-activity">暂无活动记录</div>
    </div>
  </div>
</template>

<style scoped>
.friend-detail-container {
  min-height: 100vh;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.friend-header {
  display: flex;
  align-items: center;
  padding: 20px;
  margin-bottom: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
}

.avatar-container {
  margin-right: 20px;
}

.avatar {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border: 3px solid #e6ecf0;
  border-radius: 50%;
}

.friend-info {
  flex: 1;
}

.friend-name {
  margin: 0 0 5px;
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.friend-username {
  margin: 0 0 10px;
  font-size: 16px;
  color: #657786;
}

.friend-status {
  display: inline-block;
  padding: 3px 10px;
  font-size: 14px;
  font-weight: 500;
  border-radius: 15px;
}

.online {
  color: #1890ff;
  background-color: #e6f7ff;
}

.offline {
  color: #999;
  background-color: #f5f5f5;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.friend-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  padding: 20px;
  text-align: center;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
}

.stat-value {
  margin-bottom: 5px;
  font-size: 32px;
  font-weight: 700;
  color: #1890ff;
}

.stat-label {
  font-size: 16px;
  color: #657786;
}

.friend-activity {
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgb(0 0 0 / 8%);
}

.section-title {
  padding-bottom: 10px;
  margin-bottom: 15px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e6ecf0;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.activity-item {
  padding: 15px;
  background-color: #f9fbfd;
  border-left: 3px solid #1890ff;
  border-radius: 8px;
}

.activity-type {
  margin-bottom: 5px;
  font-weight: 600;
  color: #1890ff;
}

.activity-content {
  margin-bottom: 5px;
  color: #333;
}

.activity-time {
  font-size: 14px;
  color: #657786;
}

.no-activity {
  padding: 30px 0;
  color: #999;
  text-align: center;
}
</style>
