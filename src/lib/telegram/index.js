import * as cheerio from 'cheerio'
import flourite from 'flourite'
import { LRUCache } from 'lru-cache'
import { $fetch } from 'ofetch'
import { getEnv } from '../env'
import prism from '../prism'

const cache = new LRUCache({
  ttl: 1000 * 15, // 15 seconds for fresher updates
  maxSize: 50 * 1024 * 1024, // 50MB
  sizeCalculation: (item) => {
    return JSON.stringify(item).length
  },
})

function getVideoStickers($, item, { staticProxy, index }) {
  return $(item).find('.js-videosticker_video')?.map((_index, video) => {
    const url = $(video)?.attr('src')
    const imgurl = $(video).find('img')?.attr('src')
    return `
    <div style="background-image: none; width: 256px;">
      <video src="${staticProxy + url}" width="100%" height="100%" alt="Video Sticker" preload muted autoplay loop playsinline disablepictureinpicture >
        <img class="sticker" src="${staticProxy + imgurl}" alt="Video Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" />
      </video>
    </div>
    `
  })?.get()?.join('')
}

function getImageStickers($, item, { staticProxy, index }) {
  return $(item).find('.tgme_widget_message_sticker')?.map((_index, image) => {
    const url = $(image)?.attr('data-webp')
    return `<img class="sticker" src="${staticProxy + url}" style="width: 256px;" alt="Sticker" loading="${index > 15 ? 'eager' : 'lazy'}" />`
  })?.get()?.join('')
}

function getImages($, item, { staticProxy, id, index, title }) {
  const images = $(item).find('.tgme_widget_message_photo_wrap')?.map((_index, photo) => {
    const url = $(photo).attr('style').match(/url\(["'](.*?)["']/)?.[1]
    if (!url)
      return null
    const fullUrl = staticProxy + url
    return `
      <button
        class="image-preview-button image-preview-wrap"
        type="button"
        data-image-index="${_index}"
        data-image-url="${fullUrl}"
        aria-label="Open image preview"
      >
        <img src="${fullUrl}" alt="${title}" loading="${index > 15 ? 'eager' : 'lazy'}" />
      </button>
    `
  })?.get()?.filter(Boolean)

  if (!images?.length)
    return ''

  const containerClass = images.length % 2 === 0 ? 'image-list-even' : 'image-list-odd'
  return `<div class="image-list-container ${containerClass}" data-post-id="${id}">${images.join('')}</div>`
}

function getVideo($, item, { staticProxy, index }) {
  const video = $(item).find('.tgme_widget_message_video_wrap video')
  video?.attr('src', staticProxy + video?.attr('src'))
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true)
    .attr('webkit-playsinline', true)

  const roundVideo = $(item).find('.tgme_widget_message_roundvideo_wrap video')
  roundVideo?.attr('src', staticProxy + roundVideo?.attr('src'))
    ?.attr('controls', true)
    ?.attr('preload', index > 15 ? 'auto' : 'metadata')
    ?.attr('playsinline', true)
    .attr('webkit-playsinline', true)
  return $.html(video) + $.html(roundVideo)
}

function getAudio($, item, { staticProxy }) {
  const audio = $(item).find('.tgme_widget_message_voice')
  audio?.attr('src', staticProxy + audio?.attr('src'))
    ?.attr('controls', true)
  return $.html(audio)
}

function getLinkPreview($, item, { staticProxy, index }) {
  const link = $(item).find('.tgme_widget_message_link_preview')
  const title = $(item).find('.link_preview_title')?.text() || $(item).find('.link_preview_site_name')?.text()
  const description = $(item).find('.link_preview_description')?.text()

  link?.attr('target', '_blank').attr('rel', 'noopener').attr('title', description)

  const image = $(item).find('.link_preview_image')
  const src = image?.attr('style')?.match(/url\(["'](.*?)["']/i)?.[1]
  const imageSrc = src ? staticProxy + src : ''
  image?.replaceWith(`<img class="link_preview_image" alt="${title}" src="${imageSrc}" loading="${index > 15 ? 'eager' : 'lazy'}" />`)
  return $.html(link)
}

function getReply($, item, { channel }) {
  const reply = $(item).find('.tgme_widget_message_reply')
  reply?.wrapInner('<small></small>')?.wrapInner('<blockquote></blockquote>')

  const href = reply?.attr('href')
  if (href) {
    const url = new URL(href)
    reply?.attr('href', `${url.pathname}`.replace(new RegExp(`/${channel}/`, 'i'), '/posts/'))
  }

  return $.html(reply)
}

function modifyHTMLContent($, content, { index } = {}) {
  $(content).find('.emoji')?.removeAttr('style')
  $(content).find('a')?.each((_index, a) => {
    $(a)?.attr('title', $(a)?.text())?.removeAttr('onclick')
  })
  $(content).find('tg-spoiler')?.each((_index, spoiler) => {
    const id = `spoiler-${index}-${_index}`
    $(spoiler)?.attr('id', id)?.wrap('<label class="spoiler-button"></label>')?.before(`<input type="checkbox" />`)
  })
  $(content).find('pre').each((_index, pre) => {
    try {
      $(pre).find('br')?.replaceWith('\n')

      const code = $(pre).text()
      const language = flourite(code, { shiki: true, noUnknown: true })?.language || 'text'
      const highlightedCode = prism.highlight(code, prism.languages[language], language)
      $(pre).html(`<code class="language-${language}">${highlightedCode}</code>`)
    }
    catch (error) {
      console.error(error)
    }
  })
  return content
}

function getPost($, item, { channel, staticProxy, index = 0 }) {
  item = item ? $(item).find('.tgme_widget_message') : $('.tgme_widget_message')
  const content = $(item).find('.js-message_reply_text')?.length > 0
    ? modifyHTMLContent($, $(item).find('.tgme_widget_message_text.js-message_text'), { index })
    : modifyHTMLContent($, $(item).find('.tgme_widget_message_text'), { index })
  const title = content?.text()?.match(/^.*?(?=[。\n]|http\S)/g)?.[0] ?? content?.text() ?? ''
  const id = $(item).attr('data-post')?.replace(new RegExp(`${channel}/`, 'i'), '')

  const tags = $(content).find('a[href^="?q="]')?.each((_index, a) => {
    const tagText = $(a)?.text()
    const tagName = tagText?.replace('#', '')
    $(a)?.attr('href', `/search/tag/${encodeURIComponent(tagName)}`)
  })?.map((_index, a) => $(a)?.text()?.replace('#', ''))?.get()

  return {
    id,
    title,
    type: $(item).attr('class')?.includes('service_message') ? 'service' : 'text',
    datetime: $(item).find('.tgme_widget_message_date time')?.attr('datetime'),
    tags,
    text: content?.text(),
    content: [
      getReply($, item, { channel }),
      getImages($, item, { staticProxy, id, index, title }),
      getVideo($, item, { staticProxy, id, index, title }),
      getAudio($, item, { staticProxy, id, index, title }),
      content?.html(),
      getImageStickers($, item, { staticProxy, index }),
      getVideoStickers($, item, { staticProxy, index }),
      // $(item).find('.tgme_widget_message_sticker_wrap')?.html(),
      $(item).find('.tgme_widget_message_poll')?.html(),
      $.html($(item).find('.tgme_widget_message_document_wrap')),
      $.html($(item).find('.tgme_widget_message_video_player.not_supported')),
      $.html($(item).find('.tgme_widget_message_location_wrap')),
      getLinkPreview($, item, { staticProxy, index }),
    ].filter(Boolean).join('').replace(/(url\(["'])((https?:)?\/\/)/g, (match, p1, p2, _p3) => {
      if (p2 === '//') {
        p2 = 'https://'
      }
      if (p2?.startsWith('t.me')) {
        return false
      }
      return `${p1}${staticProxy}${p2}`
    }),
  }
}

const unnessaryHeaders = ['host', 'cookie', 'origin', 'referer']

// Fetch single channel data
async function fetchSingleChannel(Astro, channel, { before = '', after = '', id = '' } = {}) {
  const host = getEnv(import.meta.env, Astro, 'TELEGRAM_HOST') ?? 't.me'
  const staticProxy = getEnv(import.meta.env, Astro, 'STATIC_PROXY') ?? '/static/'

  const url = id ? `https://${host}/${channel}/${id}?embed=1&mode=tme` : `https://${host}/s/${channel}`
  const headers = Object.fromEntries(Astro.request.headers)

  Object.keys(headers).forEach((key) => {
    if (unnessaryHeaders.includes(key)) {
      delete headers[key]
    }
  })

  console.info('Fetching from Telegram', url, { channel, before, after, id })
  const html = await $fetch(url, {
    headers,
    query: {
      before: before || undefined,
      after: after || undefined,
    },
    retry: 3,
    retryDelay: 100,
  })

  const $ = cheerio.load(html, {}, false)

  if (id) {
    return getPost($, null, { channel, staticProxy })
  }

  const posts = $('.tgme_channel_history  .tgme_widget_message_wrap')?.map((index, item) => {
    const post = getPost($, item, { channel, staticProxy, index })
    return { ...post, channel } // Add channel info to each post
  })?.get()?.reverse().filter(post => ['text'].includes(post.type) && post.id && post.content)

  return {
    posts,
    title: $('.tgme_channel_info_header_title')?.text(),
    description: $('.tgme_channel_info_description')?.text(),
    descriptionHTML: modifyHTMLContent($, $('.tgme_channel_info_description'))?.html(),
    avatar: $('.tgme_page_photo_image img')?.attr('src'),
    channel,
  }
}

export async function getChannelInfo(Astro, { before = '', after = '', q = '', type = 'list', id = '', singleChannel = '' } = {}) {
  // Check if multi-channel mode is enabled
  const channelsEnv = getEnv(import.meta.env, Astro, 'CHANNELS')
  const channels = channelsEnv ? channelsEnv.split(',').map(c => c.trim()).filter(Boolean) : []
  const defaultChannel = getEnv(import.meta.env, Astro, 'CHANNEL')

  // If singleChannel is specified, only fetch that channel
  const isMultiChannel = channels.length > 0 && !singleChannel
  const targetChannels = singleChannel ? [singleChannel] : (isMultiChannel ? channels : [defaultChannel])

  // Cache key without search query to reuse base data
  const baseCacheKey = JSON.stringify({ channels: targetChannels, before, after, q: '', type, id })
  const cachedResult = cache.get(baseCacheKey)
  const isRealtimeSearch = Boolean(q)

  // If we have cached data, use it for search instead of fetching again
  if (cachedResult && !isRealtimeSearch) {
    console.info('Match Cache', { channels: targetChannels, before, after, q, type, id })
    const result = JSON.parse(JSON.stringify(cachedResult))

    if (q) {
      result.posts = filterAndHighlightPosts(result.posts, q)
    }

    return result
  }

  // Fetch data from all channels
  const channelDataPromises = targetChannels.map((channel) =>
    fetchSingleChannel(Astro, channel, { before, after, id }).catch((error) => {
      console.error(`Failed to fetch channel ${channel}:`, error)
      return null
    }),
  )

  const channelDataList = (await Promise.all(channelDataPromises)).filter(Boolean)

  if (id) {
    // For single post view, find the first valid result with actual content
    const post = channelDataList.find((data) => data && data.id && data.content)
    if (post) {
      cache.set(baseCacheKey, post)
      return post
    }
    // If no valid post found, return null or first result
    const fallback = channelDataList[0]
    if (fallback) {
      cache.set(baseCacheKey, fallback)
    }
    return fallback
  }

  // Aggregate posts from all channels
  const allPosts = channelDataList.flatMap(data => data.posts || [])

  // Sort by datetime (newest first)
  allPosts.sort((a, b) => new Date(b.datetime) - new Date(a.datetime))

  // Use first channel as primary channel for title, description and avatar
  const primaryChannel = channelDataList[0]

  const channelInfo = {
    posts: allPosts,
    title: primaryChannel?.title,
    description: primaryChannel?.description,
    descriptionHTML: primaryChannel?.descriptionHTML,
    avatar: primaryChannel?.avatar,
    channels: channelDataList.map(d => ({
      name: d.channel,
      title: d.title,
      avatar: d.avatar,
    })),
    isMultiChannel: isMultiChannel && !singleChannel,
  }

  // Always cache the base data (without search filtering)
  if (!isRealtimeSearch) {
    cache.set(baseCacheKey, channelInfo)
  }

  // Apply search filtering if needed (on a copy to avoid modifying cache)
  if (q) {
    const result = JSON.parse(JSON.stringify(channelInfo))
    result.posts = filterAndHighlightPosts(result.posts, q)
    return result
  }

  return channelInfo
}

// Escape special regex characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Highlight search term in HTML content
function highlightInHTML(html, searchTerm) {
  if (!html || !searchTerm)
    return html

  const escapedTerm = escapeRegex(searchTerm)
  const regex = new RegExp(`(${escapedTerm})`, 'gi')

  // Replace text nodes only, avoiding HTML tags, including leading/trailing text
  return html.replace(/(^|>)([^<>]+)(?=<|$)/g, (match, prefix, text) => {
    const highlighted = text.replace(regex, '<mark class="search-highlight">$1</mark>')
    return `${prefix}${highlighted}`
  })
}

// Filter and highlight posts by search query
function filterAndHighlightPosts(posts, q) {
  const searchTerm = q.toLowerCase().trim()
  const isTagSearch = searchTerm.startsWith('#')

  if (isTagSearch) {
    // Tag search: exact match on tags with highlighting
    const tagName = searchTerm.substring(1)
    return posts.filter(post =>
      post.tags && post.tags.some(tag => tag.toLowerCase() === tagName),
    ).map((post) => {
      // Highlight the tag in content
      return {
        ...post,
        content: highlightInHTML(post.content, `#${tagName}`),
      }
    })
  }
  else {
    // Text search: partial keyword matching with highlighting
    return posts.filter((post) => {
      const titleMatch = post.title?.toLowerCase().includes(searchTerm)
      const textMatch = post.text?.toLowerCase().includes(searchTerm)
      return titleMatch || textMatch
    }).map((post) => {
      // Highlight the search term in content
      return {
        ...post,
        content: highlightInHTML(post.content, searchTerm),
      }
    })
  }
}

// Get all unique tags from channel posts
export async function getAllTags(Astro) {
  const channelInfo = await getChannelInfo(Astro, {})
  const tagSet = new Set()

  channelInfo.posts?.forEach((post) => {
    if (post.tags && Array.isArray(post.tags)) {
      post.tags.forEach(tag => tagSet.add(tag))
    }
  })

  return Array.from(tagSet).sort()
}
