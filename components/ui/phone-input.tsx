import React from "react";
import { Input } from "@/components/ui/input";
import { countryCodes } from "./country-codes";

export function PhoneInput() {
  return (
    <div className="flex gap-2">
      <select
        name="countryCode"
        required
        defaultValue="1"
        className="w-40 flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">Select country</option>
        {countryCodes.map((country) => (
          <option key={country.name} value={country.code}>
            {country.name}
          </option>
        ))}
      </select>
      <Input
        name="phoneNumber"
        placeholder="Phone number"
        required
        pattern="^[0-9]{1,14}$"
        title="Please enter only numbers"
        className="flex-1"
        maxLength={14}
        minLength={5}
        type="tel"
      />
    </div>
  );
}
