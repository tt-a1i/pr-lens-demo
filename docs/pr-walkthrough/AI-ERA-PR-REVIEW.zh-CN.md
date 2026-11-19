# AI 时代的 PR 讲解：意图、架构与复杂度

代码生成加快之后，审阅者仍需要理解变更的目的、结构和代价。本展示尝试用三个问题组织阅读，再用源码与测试复核图中的说法。图解负责导航，审查结论仍由代码证据、测试和维护者判断共同支撑。

## 思路来源与适用范围

- Margaret-Anne Storey 在 [Cognitive Debt Revisited](https://margaretstorey.com/blog/2026/02/18/cognitive-debt-revisited/) 中讨论系统结构演化与团队共同理解之间的缺口。
- Armin Ronacher 在 [The Final Bottleneck](https://lucumr.pocoo.org/2026/2/13/the-final-bottleneck/) 中讨论代码产出、审查能力与责任之间的约束。
- Mitchell Hashimoto 在 [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey#step-5-engineer-the-harness) 中建议把反复纠错的经验沉淀进工具和文档。

下文的“三问”是本展示采用的组织方法，这些文章为设计提供了启发。

## 1. 意图：为什么改，哪些对外契约跟着改变？

先写清预期效果，再确认 HTTP/RPC 返回语义、同步或异步时机、重试、幂等和持久化保证。

Pulse Billing [PR #5](https://github.com/tt-a1i/pr-lens-demo/pull/5) 从等待扣款与发信后返回 `200`，改为领取幂等锁并调用入队接口后返回 `202 queued`。架构图交代同步基线，时序图解释调用顺序，代码片段核对返回值，ERD 展示 `invoices.org_id` 与幂等键唯一索引。

边界同样需要展示：这个 demo 的 `enqueueCheckoutJob()` 只返回示例 `jobId`，没有实际队列；Worker 函数存在，但尚未证明端到端持久化执行。`db/schema.sql` 的状态默认值为 `queued`，迁移脚本未同步修改该默认值，仍需单独核对。不能从连线动画推导这些运行时保证。

## 2. 架构：依赖、所有权和执行路径如何变化？

围绕发生变化的模块，说明新增依赖、责任迁移、共享状态和故障边界，并保留未改变但受影响的相邻对象。

- Tokio [#1657](https://github.com/tokio-rs/tokio/pull/1657) 用架构图讲局部队列、溢出和批量窃取，再用生命周期图讲 Worker 状态。这里选择了调度器这一条主线，未覆盖该 PR 的全部变化。
- Archify 自举案例用架构图说明通用编排与领域经验的边界，再用数据流图说明 SVG 和视频的输出路径。GPU 回读属于视频导出管线，MP4 索引与封装属于 `StoryContainer`，两者分别承担责任。

图结构按问题选。跨图保留稳定对象身份，在一个画布内顺序推进；代码片段在需要核对时出现。动态图的“选中”是预编排的演示动作，PR 评论中的图片不接收交互点击。

## 3. 复杂度：变化发生在哪一层？

区分函数本身、嵌套函数和模块关系。报告前后数值、度量口径和对应代码，不把复杂度增加直接等同于缺陷。

Vue [#2532](https://github.com/vuejs/core/pull/2532) 复用此前固定版本的[静态度量快照](measurements/vue.json)：外层 `processExpression()` 为 `22 → 22`，嵌套的 `prefix()` 为 `2 → 6`，嵌套深度为 `0 → 2`。本例将指标附着于函数对象，随后展示对应源码。

这些数值由调用方提供，通用 Story 引擎负责渲染，未自动推导该 PR 的复杂度结论。固定版本见 [source-revisions.json](source-revisions.json)；没有重新扫描当前 Vue 主线。

## 交付形式与职责边界

PRLens 的产品形态可拆为评论内图像、外部交互网站和自动生成/发布工作流。本次聚焦第一种，并复用 Arc 的离线交互与视频导出能力：

1. PR 评论展示单张双主题动态 SVG，讲解文字放在图内，支持减少动态效果；静态关键帧供展开阅读。
2. 交互 Stage HTML 可下载后离线打开，支持暂停、跳步骤和查看导出效果；GitHub 的文件预览不会执行 HTML。
3. MP4 用于演示和分享；生成脚本可选输出视频。

本次没有部署网站、GitHub App 或自动发布 Action。已有 CLI、图结构和动效是通用组件；PR 的关注点、选图、讲解与分析输入留在本展示目录，后续可提炼成领域 Skill。
