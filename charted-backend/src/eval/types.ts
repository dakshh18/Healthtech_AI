export type GoldExpected = {
  chiefComplaint: string;
  medications: string[];
  allergies: string[];
  icdCodes: string[];
};

export type GoldCase = {
  id: string;
  complaint: string;
  transcript: string;
  plantedPhi: string[];
  expected: GoldExpected;
};
