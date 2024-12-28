import { Input } from "@/components/ui/input";

export function PhoneInput() {
  return (
    <div className="flex gap-2">
      <Input
        name="areaCode"
        placeholder="Area code"
        required
        pattern="^[0-9]{1,4}$"
        title="Please enter only numbers"
        className="w-24"
        maxLength={4}
      />
      <Input
        name="phoneNumber"
        placeholder="Phone number"
        required
        pattern="^[0-9]{1,14}$"
        title="Please enter only numbers"
        className="flex-1"
        maxLength={14}
      />
    </div>
  );
}
