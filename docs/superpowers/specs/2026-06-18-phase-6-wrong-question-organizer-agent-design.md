# Phase 6 WrongQuestion Organizer Agent Design

## 背景

当前错题本以错题列表为主，适合验证 CRUD、复习卡和离线补偿链路，但长期使用时信息架构不够清晰。真实学习场景里，用户通常先按学科进入错题本，再在学科内部查看知识专题、错因类型和复习状态。

Phase 6 引入 LangGraph 多 Agent 后，错题整理应该成为一个独立子能力，而不是继续只靠前端 `subject` 字段做简单分组。

## 产品目标

- 错题首页以学科卡片为第一层入口，例如“高等数学”“大学英语”。
- 学科卡片内部再按 AI 归纳出的专题拆分，例如“曲线积分与格林公式”“四级阅读长难句”。
- 卡片名称默认由 AI 根据错题内容、知识点和错因生成。
- 用户可以重命名卡片、移动错题、合并专题；用户手动修改后的名称不被 AI 自动覆盖。
- 错题详情、FSRS 复习和统计仍以原始 WrongQuestion / Card / ReviewLog 为事实来源，错题集只是组织层。

## 推荐模型

后续实现时引入两层结构：

```text
WrongQuestionSubjectGroup
- id
- userId
- subject
- displayName
- sortOrder
- createdAt
- updatedAt

WrongQuestionDeck
- id
- userId
- subjectGroupId
- name
- description
- source: AI | USER
- nameLocked
- confidence
- createdAt
- updatedAt

WrongQuestionDeckItem
- deckId
- wrongQuestionId
- reason
- confidence
- createdAt
```

其中 `WrongQuestionSubjectGroup` 对应首页学科卡片，`WrongQuestionDeck` 对应学科内部专题卡片。保留关联表是为了允许一题多归属，例如一道题既属于“高等数学”，也可进入“格林公式高频错因”专题。

## Agent 边界

Phase 6 增加 `WrongQuestionOrganizerAgent`，职责是：

- 读取结构化错题字段：`subject`、`knowledgePoints`、`questionType`、`difficulty`、`analysis`、`correctAnswer`、用户备注和复习表现。
- 判断错题应归入哪个学科组和专题 deck。
- 当没有合适专题时，生成简洁、可读、面向学习的专题名。
- 给出归类原因和置信度，供服务端记录和后续 UI 展示。
- 对用户手动重命名或锁定的 deck 只做推荐，不自动改名。

它不负责：

- 直接删除错题。
- 绕过用户确认批量改写错题内容。
- 替代 FSRS 调度算法。
- 在 Phase 5 RAG 尚未完成时依赖知识库命中结果作为唯一依据。

## LangGraph 位置

`WrongQuestionOrganizerAgent` 属于 Phase 6 多 Agent 系统的业务整理节点，可由以下事件触发：

```text
保存错题成功
  -> OrganizerAgent 建议学科组与专题 deck
  -> 服务端写入 deck 关联
  -> 错题本首页按学科卡片展示

用户手动移动 / 重命名
  -> 写入用户偏好或锁定字段
  -> 后续 Agent 归类尊重用户选择
```

它后续可以和 `PlannerAgent` 联动：当某个专题错题密度高、复习压力高或近期连续答错时，学习计划可以优先推荐该专题。

## UI 方向

错题本首页：

- 第一屏展示学科卡片，不平铺所有错题。
- 卡片展示错题数量、待复习数量、掌握率、最近更新和主要薄弱专题。
- 进入学科后展示专题卡片，再进入专题错题列表。

专题页：

- 展示专题说明、AI 归纳原因、错题列表和复习入口。
- 支持重命名专题、移动错题、删除专题关联。

## 分阶段落地

1. Phase 6.1：补充错题集数据模型与 contract。
2. Phase 6.2：错题本 UI 从平铺列表改为学科卡片 + 专题下钻。
3. Phase 6.3：LangGraph `WrongQuestionOrganizerAgent` 接入错题保存后归类建议。
4. Phase 6.4：支持用户重命名、移动、合并专题，并把用户选择写回偏好。
5. Phase 6.5：与 `PlannerAgent`、复习压力和 RAG 学习资料联动。

## 验收标准

- 新用户保存多道不同学科错题后，错题首页按学科卡片展示。
- 同一学科内错题能按专题组织，而不是只按时间排序。
- AI 自动生成的专题名可读、短、学习导向。
- 用户重命名专题后，后续自动整理不会覆盖该名称。
- 错题复习、统计和离线补偿仍以原有服务端数据流为准。
