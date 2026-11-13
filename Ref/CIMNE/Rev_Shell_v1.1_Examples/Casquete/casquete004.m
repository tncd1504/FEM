%=======================================================================
% MAT-fem_RevShells 1.0  - MAT-fem is a learning tool for undestanding 
%                         the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = Untitled
%
%  Material Properties
%
  young   =   2.000000000e+06 ;
  poiss   =   1.666666660e-01 ;
  denss   =   0.000000000e+00 ;
  thick   =   3.000000000e+00 ;
%
% Coordinates
%
global coordinates
coordinates = [
   5.162187927e+01   ,   7.372368399e+01  ;
   3.980598212e+01   ,   8.071854674e+01  ;
   2.706352196e+01   ,   8.583452557e+01  ;
   1.369110476e+01   ,   8.895253594e+01  ;
   0.000000000e+00   ,   9.000000000e+01  ] ; 
%
% Elements
%
global elements
elements = [
      5   ,      4   ; 
      4   ,      3   ; 
      3   ,      2   ; 
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
      1  , 1 ,   0.000000000e+00  ;
      1  , 2 ,   0.000000000e+00  ;
      1  , 3 ,   0.000000000e+00  ;
      5  , 1 ,   0.000000000e+00  ;
      5  , 3 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [ ] ;
%
% Side loadsss
%
uniload = sparse ( 4 );
uniload (      1  ) =  -1.000000000e+00  ;
uniload (      2  ) =  -1.000000000e+00  ;
uniload (      3  ) =  -1.000000000e+00  ;
uniload (      4  ) =  -1.000000000e+00  ;



