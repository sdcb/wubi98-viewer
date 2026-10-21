export interface KeyInfo {
  key: string
  zone: number
  pos: number
  name: string
  mnemonic: string
}

const RAW: [string, string, string][] = [
  ['g', '王', '王旁青头五夫一'],
  ['f', '土', '土干十寸未甘雨'],
  ['d', '大', '大犬戊其古石厂'],
  ['s', '木', '木丁西甫一四里'],
  ['a', '工', '工戈草头右框七'],
  ['h', '目', '目上卜止虎头具'],
  ['j', '日', '日早两竖与虫依'],
  ['k', '口', '口中两川三个竖'],
  ['l', '田', '田甲方框四车里'],
  ['m', '山', '山由贝骨下框集'],
  ['t', '禾', '禾竹反文双人立'],
  ['r', '白', '白斤气丘叉手提'],
  ['e', '月', '月用力豸毛衣臼'],
  ['w', '人', '人八登头单人几'],
  ['q', '金', '金夕鸟儿犭边鱼'],
  ['y', '言', '言文方点谁人去'],
  ['u', '立', '立辛六羊病门里'],
  ['i', '水', '水族三点鳖头小'],
  ['o', '火', '火业广鹿四点米'],
  ['p', '之', '之字宝盖补礻衤'],
  ['n', '已', '已类左框心尸羽'],
  ['b', '子', '子耳了也乃框皮'],
  ['v', '女', '女刀九艮山西倒'],
  ['c', '又', '又巴牛厶马失蹄'],
  ['x', '纟', '幺母贯头弓和匕'],
]

export const KEYS: Record<string, KeyInfo> = Object.fromEntries(
  RAW.map(([key, name, mnemonic], i) => [key, { key, zone: Math.floor(i / 5) + 1, pos: (i % 5) + 1, name, mnemonic }]),
)

export const ZONE_NAMES = ['', '横区', '竖区', '撇区', '点区', '折区']
export const STROKE_NAMES = ['', '横', '竖', '撇', '点', '折']
export const STROKE_KEYS = ['', 'g', 'h', 't', 'y', 'n']

export const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'xcvbnm']

export function keyAt(zone: number, pos: number): string {
  return RAW[(zone - 1) * 5 + (pos - 1)][0]
}

export const STRUCT_NAMES: Record<number, string> = { 1: '左右型', 2: '上下型', 3: '杂合型' }
