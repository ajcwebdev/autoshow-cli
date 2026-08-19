export type TreeNode = {
  dirs: Map<string, TreeNode>
  files: string[]
}
