import type {
  PermissionMenuOption,
  PermissionSummary,
  PermissionTreeNode
} from './types';

function comparePermissionNode(
  left: Pick<PermissionSummary, 'sortOrder' | 'pathLabel' | 'name'>,
  right: Pick<PermissionSummary, 'sortOrder' | 'pathLabel' | 'name'>
) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  const pathLabelOrder = left.pathLabel.localeCompare(right.pathLabel, 'zh-CN');
  if (pathLabelOrder !== 0) {
    return pathLabelOrder;
  }

  return left.name.localeCompare(right.name, 'zh-CN');
}

export function buildPermissionTree(
  permissions: PermissionSummary[]
): PermissionTreeNode[] {
  const nodeMap = new Map<string, PermissionTreeNode>();
  const roots: PermissionTreeNode[] = [];

  permissions.forEach((permission) => {
    nodeMap.set(permission.code, {
      ...permission,
      children: []
    });
  });

  permissions.forEach((permission) => {
    const currentNode = nodeMap.get(permission.code);
    if (!currentNode) {
      return;
    }

    const parentNode = permission.parentCode
      ? nodeMap.get(permission.parentCode)
      : null;

    if (parentNode) {
      parentNode.children.push(currentNode);
      return;
    }

    roots.push(currentNode);
  });

  const sortNodes = (nodes: PermissionTreeNode[]) => {
    nodes.sort(comparePermissionNode);
    nodes.forEach((node) => sortNodes(node.children));
    return nodes;
  };

  return sortNodes(roots);
}

export function flattenPermissionTree(
  nodes: PermissionTreeNode[]
): PermissionTreeNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenPermissionTree(node.children)
  ]);
}

export function buildPermissionMenuOptions(
  nodes: PermissionTreeNode[]
): PermissionMenuOption[] {
  const options: PermissionMenuOption[] = [];

  const visitNode = (node: PermissionTreeNode, depth: number) => {
    if (node.permissionType === 'menu') {
      options.push({
        value: node.code,
        label: `${'　'.repeat(depth)}${node.pathLabel}`,
        depth,
        scope: node.scope,
        route: node.route
      });
    }

    node.children.forEach((child) => visitNode(child, depth + 1));
  };

  nodes.forEach((node) => visitNode(node, 0));

  return options;
}

function nodeMatchesKeyword(node: PermissionTreeNode, keyword: string) {
  if (!keyword) {
    return true;
  }

  const normalizedKeyword = keyword.toLowerCase();

  return [
    node.name,
    node.code,
    node.pathLabel,
    node.route,
    node.description,
    node.module,
    node.action
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(normalizedKeyword));
}

export function filterPermissionTree(
  nodes: PermissionTreeNode[],
  keyword: string
): PermissionTreeNode[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return nodes;
  }

  return nodes
    .map((node) => {
      const filteredChildren = filterPermissionTree(node.children, keyword);
      if (
        filteredChildren.length ||
        nodeMatchesKeyword(node, normalizedKeyword)
      ) {
        return {
          ...node,
          children: filteredChildren
        };
      }

      return null;
    })
    .filter((node): node is PermissionTreeNode => Boolean(node));
}

export function collectPermissionIds(node: PermissionTreeNode): string[] {
  return [
    node.id,
    ...node.children.flatMap((child) => collectPermissionIds(child))
  ];
}

export function collectPermissionCodes(node: PermissionTreeNode): string[] {
  return [
    node.code,
    ...node.children.flatMap((child) => collectPermissionCodes(child))
  ];
}
