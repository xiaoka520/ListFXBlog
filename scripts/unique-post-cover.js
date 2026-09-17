'use strict'

/**
 * 给使用默认封面的文章生成互不相同的封面 URL。
 *
 * 同一个页面中完全相同的图片 URL 会被浏览器合并为一次请求，
 * 导致多篇文章的封面拿到同一张随机图片。
 * 这里给每篇文章的封面追加一个稳定的唯一参数（pid），
 * 让浏览器分别发起请求，图片 API 就能为每篇文章返回不同的随机图片。
 *
 * 注意：主题的随机封面生成器可能已经把默认封面写进了文章的 cover，
 * 所以这里不仅处理“没有封面”的文章，也会把“仍是默认封面”的文章
 * 重写为带 pid 的版本；重复执行结果稳定。
 *
 * 本文件放在站点根目录的 scripts/ 下，由 Hexo 自动加载，不受主题更新影响。
 */

const crypto = require('crypto')

const PARAM_NAME = 'pid'
const HASH_LENGTH = 8

function getDefaultCovers (themeConfig) {
  const defaultCover = themeConfig && themeConfig.cover && themeConfig.cover.default_cover
  const list = Array.isArray(defaultCover) ? defaultCover : [defaultCover]
  return list.filter(item => typeof item === 'string' && item.trim())
}

function findDefaultBase (cover, covers) {
  if (typeof cover !== 'string' || !cover) return null
  return covers.find(item => cover === item || cover.startsWith(`${item}&`) || cover.startsWith(`${item}?`)) || null
}

function buildCoverUrl (base, post, index) {
  const seed = String(post.path || post.slug || post._id || index)
  const pid = crypto.createHash('sha1').update(seed).digest('hex').slice(0, HASH_LENGTH)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}${PARAM_NAME}=${pid}`
}

/**
 * 在主题的 post 生成器产出路由数据后再改写 cover。
 *
 * 为什么不在 before_generate 过滤器里改：那个阶段通过 hexo.locals 取到的文档，
 * 与生成阶段实际渲染用的文档不是同一批实例（生成开始时 locals 会再次失效并重新取数），
 * 修改会在生成时丢失。生成器返回的 data 才是模板真正使用的对象；
 * 主题的 post 生成器又注册在 index/archive/tag 等生成器之前，
 * 因此这里改写后，首页卡片、侧栏、归档页、文章页的封面都会同步更新。
 */
function applyUniqueCover (data, index) {
  if (!data || typeof data !== 'object' || data.cover === false) return

  const covers = getDefaultCovers(hexo.theme.config)
  if (covers.length === 0) return

  const current = typeof data.cover === 'string' ? data.cover : ''
  const matchedBase = findDefaultBase(current, covers)

  // 自定义封面保持原样；没有封面或仍是默认封面（可能带旧 pid）的文章重写为带唯一 pid 的地址
  if (current && !matchedBase) return

  data.cover = buildCoverUrl(matchedBase || covers[index % covers.length], data, index)
  data.cover_type = 'img'
}

/**
 * 站点脚本与主题脚本是并发加载的，顺序没有保证：主题的 post 生成器可能在本文件
 * 之后才注册。因此真正的包装放到 before_generate 阶段执行——此时所有脚本都已加载、
 * 生成器都已就位，包装的一定是最终生效的那个函数；并加标记避免重复包装。
 */
function wrapPostGenerator () {
  const generatorStore = hexo.extend.generator.list()
  const originalPostGenerator = generatorStore.post

  if (typeof originalPostGenerator !== 'function' || originalPostGenerator.__uniquePostCoverWrapped) return

  const wrapped = function (locals) {
    const running = originalPostGenerator.call(this, locals)
    const rewriteCovers = results => {
      if (Array.isArray(results)) {
        results.forEach((result, index) => applyUniqueCover(result && result.data, index))
      }
      return results
    }
    return running && typeof running.then === 'function' ? running.then(rewriteCovers) : rewriteCovers(running)
  }

  wrapped.__uniquePostCoverWrapped = true
  generatorStore.post = wrapped
}

hexo.extend.filter.register('before_generate', wrapPostGenerator)
