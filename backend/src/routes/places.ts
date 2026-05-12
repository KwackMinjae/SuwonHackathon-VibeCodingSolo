import { Router, Request, Response } from 'express'

const router = Router()

router.get('/search', async (req: Request, res: Response) => {
  const { q } = req.query as { q?: string }
  if (!q?.trim()) return res.json({ places: [] })

  const kakaoKey = process.env.KAKAO_REST_KEY?.trim()

  try {
    if (kakaoKey) {
      // 카카오 Local API (키 있을 때)
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=10`
      const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } })
      const data = await resp.json() as {
        documents: { place_name: string; address_name: string; road_address_name: string }[]
      }
      const places = (data.documents ?? []).map(d => ({
        name: d.place_name,
        address: d.road_address_name || d.address_name,
      }))
      return res.json({ places })
    } else {
      // OpenStreetMap Nominatim (키 없을 때, 무료)
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&countrycodes=kr&accept-language=ko`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'SuwonSignal/1.0 (hackathon)' },
      })
      const data = await resp.json() as {
        name: string; display_name: string; type: string; class: string
      }[]
      const places = data.map(d => {
        const parts = d.display_name.split(', ')
        // 앞 1개(장소명) 제외, 동/구/시 수준만 추출 (길지 않게)
        const addr = parts.slice(1).filter(p => !p.match(/^\d/) && p !== '대한민국').slice(0, 4).join(' ')
        return {
          name: d.name || parts[0],
          address: addr,
        }
      })
      return res.json({ places })
    }
  } catch {
    return res.status(500).json({ message: '검색에 실패했습니다.', places: [] })
  }
})

export default router
