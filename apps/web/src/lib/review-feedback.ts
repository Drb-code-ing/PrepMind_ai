import type { ReviewRating } from '@repo/types/api/review';

export type ReviewRatingOption = {
  rating: ReviewRating;
  label: string;
  effect: string;
  className: string;
};

export type ReviewRatingFeedback = {
  title: string;
  description: string;
};

const ratingOptions: ReviewRatingOption[] = [
  {
    rating: 1,
    label: '忘了',
    effect: '10 分钟后再复习',
    className: 'bg-red-50 text-red-600 ring-red-100',
  },
  {
    rating: 2,
    label: '吃力',
    effect: '30 分钟后再复习',
    className: 'bg-[#fff7df] text-[#9a6a18] ring-amber-100',
  },
  {
    rating: 3,
    label: '掌握',
    effect: '约 1 天后复习',
    className: 'bg-[#eafff9] text-[#247269] ring-[#bdeee5]',
  },
  {
    rating: 4,
    label: '轻松',
    effect: '约 4 天后复习',
    className: 'bg-[#eef7ff] text-[#315f86] ring-[#cfe5f8]',
  },
];

export function getReviewRatingOptions() {
  return ratingOptions;
}

export function getReviewRatingLabel(rating: ReviewRating) {
  return ratingOptions.find((option) => option.rating === rating)?.label ?? '已评分';
}

export function buildReviewRatingFeedback({
  rating,
  nextReview,
  now = new Date(),
}: {
  rating: ReviewRating;
  nextReview: string | Date;
  now?: Date;
}): ReviewRatingFeedback {
  return {
    title: `已记录：${getReviewRatingLabel(rating)}`,
    description: `下次复习：${formatNextReviewTime(nextReview, now)}`,
  };
}

function formatNextReviewTime(value: string | Date, now: Date) {
  const target = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(target.getTime())) {
    return '稍后同步';
  }

  const targetKey = toLocalDateKey(target);
  const todayKey = toLocalDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowKey = toLocalDateKey(tomorrow);
  const time = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(target);

  if (targetKey === todayKey) {
    return `今天 ${time}`;
  }
  if (targetKey === tomorrowKey) {
    return `明天 ${time}`;
  }

  const date = new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  }).format(target);
  return `${date} ${time}`;
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
