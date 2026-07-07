import partyRankApi from "services/api.partyRank.service";

export async function reloadPartyRankOptions() {
  const response = await partyRankApi.getRanks();
  return partyRankApi
    .unwrapList(response)
    .map(partyRankApi.normalizeRankRow)
    .filter((row) => row.rankName);
}
