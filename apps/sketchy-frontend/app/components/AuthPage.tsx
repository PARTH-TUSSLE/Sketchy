export function AuthPage ( { 
  isSignin
 }: {
  isSignin: boolean
 } ) {
  return (
    <div className="h-screen w-screen flex justify-center items-center  p-4">
      <div className="bg-neutral-600 p-4 rounded-xl">
        <input type="text" placeholder="username" /> <br />
        <input type="password" placeholder="password" /> <br />
        <button>{isSignin ? "Sign in" : "Sign up"}</button>
      </div>
    </div>
  );
}