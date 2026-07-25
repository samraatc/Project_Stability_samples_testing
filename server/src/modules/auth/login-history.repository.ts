import { LoginHistoryModel, type ILoginHistory } from './login-history.model';

export const loginHistoryRepository = {
  async record(entry: Partial<ILoginHistory>): Promise<void> {
    await LoginHistoryModel.create(entry);
  },
};
