import api from "services/api.service";

/** Minimum page size for catalog fetches — never use 1 (breaks grids and many APIs). */
export const CATALOG_FETCH_PAGE_SIZE = 1000;

/**
 * Try non-paginated GET /api/{entity} list endpoint.
 * @param {string} entity
 * @returns {Promise<{ data: unknown[], pagination: object } | null>}
 */
export async function tryFetchEntityList(entity) {
  try {
    const list = await api.list(entity);
    if (Array.isArray(list)) {
      return {
        data: list,
        pagination: {
          totalCount: list.length,
          pageNumber: 1,
          pageSize: list.length,
        },
      };
    }
  } catch (_) {
    // Fall back to paginated endpoint.
  }
  return null;
}

/**
 * Load a full paginated API catalog. Never sends pageSize=1.
 * @param {(pageNumber: number, pageSize: number) => Promise<*>} fetchPage
 * @param {{ listEntities?: string[] }} [options]
 */
export async function fetchAllPaginatedRecords(fetchPage, options = {}) {
  const { listEntities = [] } = options;
  for (let i = 0; i < listEntities.length; i += 1) {
    const fromList = await tryFetchEntityList(listEntities[i]);
    if (fromList) return fromList;
  }

  const first = await fetchPage(1, CATALOG_FETCH_PAGE_SIZE);
  if (!first?.pagination) {
    const arr = Array.isArray(first) ? first : first?.data ?? [];
    return {
      data: arr,
      pagination: { totalCount: arr.length, pageNumber: 1, pageSize: arr.length || 0 },
    };
  }

  const totalCount = Number(first.pagination.totalCount || 0);
  if (totalCount <= 0) {
    return { data: [], pagination: { totalCount: 0, pageNumber: 1, pageSize: 0 } };
  }

  let allData = [...(first.data || [])];

  if (allData.length >= totalCount) {
    return {
      data: allData.slice(0, totalCount),
      pagination: { totalCount, pageNumber: 1, pageSize: totalCount },
    };
  }

  const chunkSize = CATALOG_FETCH_PAGE_SIZE;
  const totalPages = Math.ceil(totalCount / chunkSize);

  for (let page = 2; page <= totalPages; page += 1) {
    const res = await fetchPage(page, chunkSize);
    if (res?.data) {
      allData.push(...res.data);
    }
    if (allData.length >= totalCount) break;
  }

  return {
    data: allData.slice(0, totalCount),
    pagination: { totalCount, pageNumber: 1, pageSize: totalCount },
  };
}
