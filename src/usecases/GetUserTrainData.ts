import { prisma } from "../lib/db.js";

export interface InputDto {
  userId: string;
}

export interface OutputDto {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number; // 100 representa 100%
}

export class GetUserTrainData {
  async execute(dto: InputDto): Promise<OutputDto | null> {
    const user = await prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    if (
      user.weigthInGrams === null ||
      user.heightInCentimeters === null ||
      user.age === null ||
      user.bodyFatPercentage === null
    ) {
      return null;
    }

    return {
      userId: user.id,
      userName: user.name,
      weightInGrams: user.weigthInGrams,
      heightInCentimeters: user.heightInCentimeters,
      age: user.age,
      bodyFatPercentage: user.bodyFatPercentage,
    };
  }
}
