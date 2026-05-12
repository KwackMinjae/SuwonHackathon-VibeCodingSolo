import { Router, Request, Response } from 'express'

const router = Router()

router.get('/search', async (req: Request, res: Response) => {
  const { q } = req.query as { q?: string }
  if (!q?.trim()) return res.json({ places: [] })

  const kakaoKey = process.env.KAKAO_REST_KEY?.trim()

  try {
    if (kakaoKey) {
      // 카카오 Local API (키 있을 때) - 수원/화성 지역 우선
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=15`
      const resp = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } })
      if (!resp.ok) throw new Error(`Kakao API error: ${resp.status}`)
      const data = await resp.json() as {
        documents: { place_name: string; address_name: string; road_address_name: string; category_group_name: string; x: string; y: string }[]
      }
      const places = (data.documents ?? []).map(d => ({
        name: d.place_name,
        address: d.road_address_name || d.address_name,
        category: d.category_group_name,
      }))
      return res.json({ places })
    } else {
      // Nominatim 개선 버전 - 수원/화성/봉담 지역 우선, 한국 내 검색
      const query = `${q} 수원`
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=15&countrycodes=kr&accept-language=ko&addressdetails=1`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'SuwonSignal/1.0 (hackathon@suwon.ac.kr)' },
      })
      if (!resp.ok) throw new Error(`Nominatim error: ${resp.status}`)
      const data = await resp.json() as {
        name: string; display_name: string; type: string; class: string;
        address?: { city?: string; county?: string; suburb?: string; neighbourhood?: string }
      }[]

      const places = data
        .filter(d => d.name && d.class !== 'boundary' && d.type !== 'administrative')
        .map(d => {
          const parts = d.display_name.split(', ')
          // 주소: 동/읍/구/시 수준만 추출
          const addrParts = parts.slice(1).filter(p =>
            !p.match(/^\d+/) && p !== '대한민국' && p.length < 20
          ).slice(0, 3)
          return {
            name: d.name || parts[0],
            address: addrParts.join(' '),
            category: d.type,
          }
        })
        .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i) // 중복 제거
        .slice(0, 10)

      return res.json({ places })
    }
  } catch (e) {
    console.error('[GET /places/search]', e)
    // 에러 시 빈 배열 반환 (프론트에서 처리)
    return res.json({ places: [] })
  }
})

export default router
