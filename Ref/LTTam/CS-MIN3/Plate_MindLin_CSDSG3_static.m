%--------------------------------------------------------------------------
% PURPOSE
%    Plate problem use CS-DSG3
%    Analysic static for square plate
%--------------------------------------------------------------------------
%   Coded by Ho Huu Vinh
%   FOSAT Group – HCMC, Vietnam
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013
%--------------------------------------------------------------------------

close all; clear all
format long;
global gcoord nodes nnode nel
E = 10920;
nuy = 0.3;
L = 1;                   % chieu dai tam
H = 1;                   % chieu rong tam
thick = input('Chon chieu day tam (t = 1: tam day; t = 2: tam mong):');
if thick == 1
t = L/1e1;               % chieu day tam
elseif thick == 2
t = L/1e4;               % chieu day tam
end
q = -1;

% Type mesh
nmesh = [1 2 3 4 5 6 7];
for im = 1:length(nmesh)
    Mesh = nmesh(im);
    % Mesh generation
    if Mesh == 1
        nx = 4; ny = 4;      % Mesh 4x4
    elseif Mesh == 2
        nx = 8; ny = 8;      % Mesh 8x8
    elseif Mesh == 3
        nx = 12; ny = 12;    % Mesh 12x12
    elseif Mesh == 4
        nx = 16; ny = 16;    % Mesh 16x16
    elseif Mesh == 5
        nx = 20; ny = 20;    % Mesh 20x20
    elseif Mesh == 6
        nx = 24; ny = 24;    % Mesh 24x24
    elseif Mesh == 7
        nx = 30; ny = 30;    % Mesh 24x24
    end
    nel= 2*nx*ny;            % number of elements
    nnel=3;                  % number of nodes per element
    ndof=3;                  % number of dofs per node
    nnode=(nx+1)*(ny+1);     % total number of nodes in system
    sdof=nnode*ndof;         % total system dofs
    edof=nnel*ndof;          % degrees of freedom per element
    type_element = 'T3';     % loai phan tu
    [nodes,gcoord] = mesh_square_plate(type_element,L,H,nx,ny);
    %%---------------------------- buondary condition---------------------------
    type_condition = 'SSSS';
    [bcdof,bcval]=boundary_condition(type_condition,ndof,nx,ny);
    %%------------------------------ Plot grid ---------------------------------
    % plot_mesh(type_element,gcoord,nodes,nel)    
    %----------------xac dinh cac ma tran vat lieu Db va Ds -------------------
    Db = material_matrix(1,E,nuy)*t^3/12;  % bending material property
    shearm=0.5*E/(1.0+nuy);       % shear modulus
    shcof=5/6;                    % shear correction factor
    % ma tran doi dau
    T = [1  0  0  0  0  0  0  0  0
        0  0  1  0  0  0  0  0  0
        0 -1  0  0  0  0  0  0  0
        0  0  0  1  0  0  0  0  0
        0  0  0  0  0  1  0  0  0
        0  0  0  0 -1  0  0  0  0
        0  0  0  0  0  0  1  0  0
        0  0  0  0  0  0  0  0  1
        0  0  0  0  0  0  0 -1  0];
    %--------------------------------------------------------------------------
    %                          tinh ma tran do cung
    %--------------------------------------------------------------------------
    alstab = 0.1;
    k = zeros(sdof,sdof);   % khai bao ma tran do cung ban dau la zeros
    f = zeros(sdof,1);      % khai bao matran tai toan cuc ban dau
    ke = zeros(edof,edof);
    for i = 1 : nel         % vong lap cho tat ca cac phan tu
        nd = nodes(i,:);    % so nut cua phan tu thu i
        x = gcoord(nd,1);   % toa do phuong x cho cac nut cua phan tu
        y = gcoord(nd,2);   % toa do phuong y cho cac nut cua phan tu
        cen_x  = sum(x)/3;  % toa do trong tam phuong x cua phan tu
        cen_y  = sum(y)/3;  % toa do trong tam phuong y cua phan tu        
        area = cal_area_polygon(x,y);
        % tinh he so hieu chinh thanh phan cat (chieu dai canh lon nhat)
        L12 = sqrt((x(2)-x(1))^2 + (y(2)-y(1))^2);
        L23 = sqrt((x(3)-x(2))^2 + (y(3)-y(2))^2);
        L31 = sqrt((x(3)-x(1))^2 + (y(3)-y(1))^2);
        he = max([L12,L23,L31]);
        % ma tran bien dang cat sau khi heiu chinh
        Ds=[shearm*shcof*t^3/(t^2+alstab*he^2) 0; 0 shearm*shcof*t^3/(t^2+alstab*he^2)];
        % ma tran ket noi phan tu cua 3 tam giac con
        el1 = [cen_x x(1) x(2); cen_y y(1) y(2)];
        el2 = [cen_x x(2) x(3); cen_y y(2) y(3)];
        el3 = [cen_x x(3) x(1); cen_y y(3) y(1)];
        el{1}=el1; el{2}=el2; el{3}=el3;
        for s_el = 1:length(el)
            % dien tich tam giac con
            xcoord = el{s_el}(1,:);
            ycoord = el{s_el}(2,:);
            Ase = cal_area_polygon(xcoord,ycoord);
            detJ = 2*Ase; % or = a*c-b*d
            %----------------------
            % Ma tran bien dang uon
            %-------------------------------------
            % Tinh theo bac tu do (theta)
            % Bb = [0  0 b1   0  0  b2   0  0  b3
            %       0 a1  0   0  a2  0   0  a3 0
            %       0 a1 b1   0  b2 a2   0  b3 a3];
            %      |__bb1__|  |__bb2__| |___bb3___|
            %--------------------------------------
            % xac dinh cac he so a, b, c
            a=xcoord(2)-xcoord(1); b=ycoord(2)-ycoord(1);
            c=ycoord(3)-ycoord(1); d=xcoord(3)-xcoord(1);
            % vector bien dang uon tai cac nut
            bb1 = [0 b-c 0; 0 0 d-a; 0 d-a b-c]./detJ;        % bien dang uon tai nut 1
            bb2 = [0  c  0; 0 0  -d; 0 -d  c]./detJ;          % bien dang uon tai nut 2
            bb3 = [0 -b  0; 0 0   a; 0  a -b]./detJ;          % bien dang uon tai nut 3
            % vector bien dang cat tai cac nut
            bs1 = [b-c  detJ/2  0; d-a  0  detJ/2]./detJ;     % bien dang uon tai nut 1
            bs2 = [c  a*c/2  b*c/2; -d  -a*d/2  -b*d/2]./detJ;% bien dang uon tai nut 2
            bs3 = [-b  -b*d/2  -b*c/2; a  a*d/2  a*c/2]./detJ;% bien dang uon tai nut 3
            if s_el==1
                % ma tran bien dang tam giac con 1 (O12)
                Bbs{s_el} = [bb1./3+bb2,  bb1./3+bb3,  bb1./3].*Ase;
                Bss{s_el} = [bs1./3+bs2,  bs1./3+bs3,  bs1./3].*Ase;
            elseif s_el==2
                % ma tran bien dang tam giac con 2 (O23)
                Bbs{s_el} = [bb1./3,  bb1./3+bb2,  bb1./3+bb3].*Ase;
                Bss{s_el} = [bs1./3,  bs1./3+bs2,  bs1./3+bs3].*Ase;
            elseif s_el==3;
                % ma tran bien dang tam giac con 3 (O31)
                Bbs{s_el} = [bb1./3+bb3,  bb1./3,  bb1./3+bb2].*Ase;
                Bss{s_el} = [bs1./3+bs3,  bs1./3,  bs1./3+bs2].*Ase;
            end
        end
        % ma tran bien dang uon cho phan tu thu i
        Bb = (Bbs{1}+Bbs{2}+Bbs{3})./area;
        Bb = Bb*T;        
        kb = Bb'*Db*Bb*area;
        % ma tran bien dang cat cho phan tu thu i
        Bs = (Bss{1}+Bss{2}+Bss{3})./area;
        Bs = Bs*T;
        ks = Bs'*Ds*Bs*area; 
        % ma tran do cung phan tu
        ke = kb + ks;
        % lap ghep ma tran do cung phan tu vao ma tran do cung tong the
        index = index_assemble(nd,nnel,ndof);
        k(index,index) = k(index,index) + ke;
        fe=(q*area/3)*repmat([1;0;0],3,1);
        f(index)=f(index)+fe;
    end
    % return
    %--------------------------------------------------------------------------
    %                     dieu kien bien va giai tim chuyen vi
    %--------------------------------------------------------------------------
    [k,f] = apply_condition_load(k,f,bcdof,bcval);
    U = inv(k)*f;
    W = U(1:3:end);
    max_w(im,:) = max(abs(W));
    %--------------------------------------------------------------------------
    %                               so sanh nghiem
    %--------------------------------------------------------------------------
    D1 = E*t^3/12/(1-nuy^2);
    ss_CSDSG(im,:) = max_w(im)*D1/L^4
    
end % number of mesh
if thick == 1    
    plot(1:length(nmesh),ss_CSDSG,'b-o')
    hold on
    plot(1:length(nmesh),ones(length(nmesh))*0.004270,'r')
    title('Plate thickness ')
    ylabel('Central deflection')
    xlabel('Mesh Index')
    legend('CS-DSG3','Exact')
    
elseif thick == 2
    
    plot(1:length(nmesh),ss_CSDSG,'b-o')
    hold on    
    plot(1:length(nmesh),ones(length(nmesh))*0.004060,'r')
    title('Plate thinness')
    ylabel('Central deflection')
    xlabel('Mesh Index')
    legend('CS-DSG3','Exact')
end
% ve chuyen vi
% figure('color',[1 1 1])
% trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
% shading interp
% view(0,90)
% return




