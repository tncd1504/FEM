function [bmat_b,bmat_s] = B_mat_Plate_Q4_v2_4(a,b,x,y)

%% B_Mat Computes the strain-displacement matrix for bending moments
%        and shear forces
%
%  Parameters:
%
%    Input, a : Element length in X direction
%           b : Element length in Y direction
%           x : Local X coordinate of the Gauss point
%           y : Local Y coordinate of the Gauss point
%   
%    Output, bmat_b the strain-displacement matrix for bending moments
%            bmat_s the strain-displacement matrix for shear forces

%==================

      x = x*a;
      y = y*b;
      
      N(1) = (1 - x/a)*(1 - y/b)/4;
      N(2) = (1 + x/a)*(1 - y/b)/4;
      N(3) = (1 + x/a)*(1 + y/b)/4;
      N(4) = (1 - x/a)*(1 + y/b)/4;

      dxN(1) = -( b - y )/(4*a*b);
      dxN(2) =  ( b - y )/(4*a*b);
      dxN(3) =  ( b + y )/(4*a*b);
      dxN(4) = -( b + y )/(4*a*b);

      dyN(1) = -( a - x )/(4*a*b);
      dyN(2) = -( a + x )/(4*a*b);
      dyN(3) =  ( a + x )/(4*a*b);
      dyN(4) =  ( a - x )/(4*a*b);

%==================

      bmat_b1  = [ 0,-dxN(1),     0  ;
                   0,      0,-dyN(1) ;
                   0,-dyN(1),-dxN(1)];
               
      bmat_b2  = [ 0,-dxN(2),     0  ;
                   0,      0,-dyN(2) ;
                   0,-dyN(2),-dxN(2)];
               
      bmat_b3  = [ 0,-dxN(3),     0  ;
                   0,      0,-dyN(3) ;
                   0,-dyN(3),-dxN(3)];
               
      bmat_b4  = [ 0,-dxN(4),     0  ;
                   0,      0,-dyN(4) ;
                   0,-dyN(4),-dxN(4)];

      bmat_b = [bmat_b1,bmat_b2,bmat_b3,bmat_b4];
      
%==================

      bmat_s1  = [ dxN(1), -N(1),    0  ;
                   dyN(1),     0, -N(1)];
               
      bmat_s2  = [ dxN(2), -N(2),    0  ;
                   dyN(2),     0, -N(2)];
               
      bmat_s3  = [ dxN(3), -N(3),    0  ;
                   dyN(3),     0, -N(3)];
               
      bmat_s4  = [ dxN(4), -N(4),    0  ;
                   dyN(4),     0, -N(4)];

      bmat_s = [bmat_s1,bmat_s2,bmat_s3,bmat_s4];
      
