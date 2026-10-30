import { BienForm } from "@/components/bien-form";

export default function NuevoBienPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Registrar bien</h1>
        <p className="text-sm text-muted-foreground">
          Registra uno o varios bienes nuevos. El código patrimonial se genera solo.
        </p>
      </div>
      <BienForm />
    </div>
  );
}
